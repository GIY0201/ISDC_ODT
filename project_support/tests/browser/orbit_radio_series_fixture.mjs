import {readFile} from 'node:fs/promises';
const file=new URL('../../../user_application/web/scripts/tabs/orbit_radio_series.js',import.meta.url);
let source=await readFile(file,'utf8');
source=source.replace(/from '([^']+)'/g,(_,path)=>`from '${path.startsWith('/static/visualization/')?new URL('../../../digital_twin/visualization/'+path.split('/').at(-1),import.meta.url).href:new URL(path,file).href}'`);
export const {createRadioSeries,createRadioSeriesPanel}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
