import {
 LogContext
} from "../interfaces/index.js";


export interface LoggerPlugin {


before?(
 context:LogContext
):void;



after?(
 context:LogContext
):void;



error?(
 error:Error,
 context:LogContext
):void;


}