// Mirror application's static mount for Node capture; no source rewriting.
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){
 if(specifier==='/static/communication/data_fabric.js')return next(new URL('../../../communication/browser/data_fabric.js',import.meta.url).href,context);
 return next(specifier,context);
}});
