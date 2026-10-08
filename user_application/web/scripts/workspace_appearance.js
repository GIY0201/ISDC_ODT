import {installTextPresentation,installExplanationDisclosure,installDisclosurePersistence} from './workspace_text_presentation.js?v=u036-r2';
const stopText=installTextPresentation(document.body,window);
const stopTitle=installTextPresentation(document.querySelector('title'),window);
const stopHelp=installExplanationDisclosure(document.querySelector('#screen'),window);
const stopDetails=installDisclosurePersistence(document.querySelector('#screen'),window);
window.addEventListener('pagehide',event=>{if(!event.persisted){stopText();stopTitle();stopHelp();stopDetails();} });
