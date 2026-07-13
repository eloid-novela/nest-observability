export class HighResolutionTimer {


  private start:
    bigint;


  constructor() {
    this.start =
      process.hrtime.bigint();
  }



  elapsed():

  number {

    const end =
      process.hrtime.bigint();


    return Number(
      end - this.start
    ) / 1_000_000;

  }

}