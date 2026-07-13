import {
 BaseFormatter
} from "./formatter.js";


export class JsonFormatter
extends BaseFormatter {


format(
 context:any
){

return JSON.stringify(
 {
  timestamp:
   new Date().toISOString(),

  ...context
 }
);


}


}