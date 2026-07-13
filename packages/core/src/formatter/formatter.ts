import {
 Formatter
} from "../interfaces/index.js";


export abstract class BaseFormatter
implements Formatter {


abstract format(
 context:any
):string;


}