import {
  Logger as LoggerInterface
} from "../interfaces/index.js";


export abstract class BaseLogger
implements LoggerInterface {


  abstract info(
    message:string,
    context?:any
  ):void;



  abstract warn(
    message:string,
    context?:any
  ):void;



  abstract error(
    message:string,
    error?:Error,
    context?:any
  ):void;

}