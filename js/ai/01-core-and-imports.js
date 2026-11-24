// EvenUCan AI helpers and Surgery - 01-core-and-imports.js
// One of the files in js/ai/. They are plain scripts loaded in number order and share one scope,
// so a name declared in one file can be used in any file. Keep the load order in EvenUCan.html.
'use strict';

const _intAi = window.WFEnclosure && window.WFEnclosure._internal;
const pfFam=()=>{try{return _intAi.prefBoardFamily()}catch(e){return 'ESP32-S3'}};// family of the board a new project starts from
if (!_intAi) throw new Error('EvenUCan AI features need the Enclosure Wizard to be loaded first');
const {
  WF:WFAi, $:$Ai, esc:escAi, clone:cloneAi, num:numAi, fx:fxAi, snap:snapAi,
  allParts:allPartsAi, partById:partByIdAi, builtinById:builtinByIdAi, newPartId:newPartIdAi, tidyPart:tidyPartAi, saveLib:saveLibAi,
  aiKey:aiKeyAi, aiProv:aiProvAi, askKey:askKeyAi, aiRead:aiReadAi, claude:claudeAi, gemini:geminiAi, oaAI:oaAIAi, PROVIDERS:PROVIDERSAi, OA:OAAi, isOA:isOAAi, getVisionFailoverList:getVisionFailoverListAi,
  readWiz:readWizAi, saveWiz:saveWizAi, ewBack:ewBackAi, plBack:plBackAi, openWizard:openWizardAi, closeWizard:closeWizardAi,
  openLibrary:openLibraryAi, closeLibrary:closeLibraryAi, updateStrip:updateStripAi, ewProjRender:ewProjRenderAi,
  wrBack:wrBackAi, openWiring:openWiringAi, closeWiring:closeWiringAi, openWiringGated:openWiringGatedAi, planWiring:planWiringAi,
  PLATFORMS:PLATFORMSAi, pfOk:pfOkAi, pfNorm:pfNormAi, CTRL_PARTS:CTRL_PARTSAi, CTRL_IDS:CTRL_IDSAi, ctrlPart:ctrlPartAi, pfMatches:pfMatchesAi,
  esphomeYaml:esphomeYamlAi, esphForm:esphFormAi, esphSlug:esphSlugAi, downloadBox:downloadBoxAi, TYPES:TYPESAi, BUILTIN:BUILTINAi,
  idbGet:idbGetAi, idbSet:idbSetAi, WIZ_KEY:WIZ_KEYAi, searchParts:searchPartsAi, _cdStart:_cdStartAi, _cdStop:_cdStopAi,
  ESPH_KEY:ESPH_KEYAi, ESPH_AI_KEY:ESPH_AI_KEYAi, ensureLibraryReady:ensureLibraryReadyAi, accOf:accOfAi,
  drawGuide:drawGuideAi, openInIde:openInIdeAi, currentCode:currentCodeAi, copyText:copyTextAi, POW_NAME:POW_NAMEAi,
  netNeeded:netNeededAi, NO_NET:NO_NETAi, NET_RE:NET_REAi, PHONE_RE:PHONE_REAi, wifiMem:wifiMemAi, capIssues:capIssuesAi, capHtml:capHtmlAi, ntfyBox:ntfyBoxAi, openLabel:openLabelAi, toolName:toolNameAi, yq:yqAi
} = _intAi;

let customAi = _intAi.custom;
let wizAi = _intAi.wiz;
let wrAi = _intAi.wr;
let layAi = _intAi.lay;
let pfCodeAi = _intAi.pfCode;
let pfMsgAi = _intAi.pfMsg;
let gStepAi = _intAi.gStep;
