// import {
//  BaseLogger
// } from "./logger.js";


// // import {
// //  Formatter
// // } from "../formatter/pretty.js";


// export class ConsoleLogger
// extends BaseLogger {


// // constructor(
// //  private formatter:Formatter
// // ){super();}



// info(
//  message:string,
//  context:any
// ){

//  console.log(
//   this.formatter.format({
//     ...context,
//     message
//   })
//  );

// }



// warn(
//  message:string,
//  context:any
// ){

//  console.warn(
//   this.formatter.format({
//     ...context,
//     message
//   })
//  );

// }



// error(
//  message:string,
//  error?:Error,
//  context?:any
// ){

//  console.error(
//   this.formatter.format({
//     ...context,
//     message,
//     error:error?.message
//   })
//  );

// }


// }