import {
 BaseFormatter
} from "./formatter.js";


export class PrettyFormatter
extends BaseFormatter {


format(
 context:any
){

return [
 context.method,
 context.path,
 context.status,
 `${context.duration}ms`,
 context.ip
]
.filter(Boolean)
.join(" ");

}


}