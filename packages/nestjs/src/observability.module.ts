import {
  Global,
  Inject,
  Module,
  type DynamicModule,
  type FactoryProvider,
  type MiddlewareConsumer,
  type NestModule,
  type Provider,
} from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { OBSERVABILITY_LOGGER, OBSERVABILITY_OPTIONS } from "./constants.js";
import { ObservabilityExceptionFilter } from "./observability.exception-filter.js";
import { ObservabilityInterceptor } from "./observability.interceptor.js";
import { ObservabilityLogger } from "./observability.logger.js";
import {
  resolveOptions,
  type ObservabilityModuleOptions,
  type ResolvedObservabilityOptions,
} from "./options.js";
import { RequestContextMiddleware } from "./request-context.middleware.js";

export interface ObservabilityRegistrationOptions {
  /**
   * Register a global catch-all exception filter so errors thrown by guards, pipes
   * and middleware also reach the completion log. Responses are unchanged.
   * Defaults to true. Set to false if you already register your own catch-all filter.
   */
  captureExceptions?: boolean;
}

export interface ObservabilityModuleAsyncOptions extends ObservabilityRegistrationOptions {
  imports?: DynamicModule["imports"];
  inject?: FactoryProvider["inject"];
  useFactory: (
    ...args: never[]
  ) => ObservabilityModuleOptions | Promise<ObservabilityModuleOptions>;
}

@Global()
@Module({})
export class ObservabilityModule implements NestModule {
  constructor(
    @Inject(OBSERVABILITY_OPTIONS)
    private readonly options: ResolvedObservabilityOptions,
  ) {}

  static forRoot(
    options: ObservabilityModuleOptions & ObservabilityRegistrationOptions = {},
  ): DynamicModule {
    return ObservabilityModule.build(
      [{ provide: OBSERVABILITY_OPTIONS, useValue: resolveOptions(options) }],
      options,
    );
  }

  static forRootAsync(options: ObservabilityModuleAsyncOptions): DynamicModule {
    const module = ObservabilityModule.build(
      [
        {
          provide: OBSERVABILITY_OPTIONS,
          inject: options.inject ?? [],
          useFactory: async (...args: never[]) => resolveOptions(await options.useFactory(...args)),
        },
      ],
      options,
    );

    return { ...module, imports: options.imports ?? [] };
  }

  private static build(
    optionsProviders: Provider[],
    registration: ObservabilityRegistrationOptions,
  ): DynamicModule {
    const providers: Provider[] = [
      ...optionsProviders,
      {
        provide: OBSERVABILITY_LOGGER,
        inject: [OBSERVABILITY_OPTIONS],
        useFactory: (options: ResolvedObservabilityOptions) => options.logger,
      },
      ObservabilityLogger,
      RequestContextMiddleware,
      { provide: APP_INTERCEPTOR, useClass: ObservabilityInterceptor },
    ];

    if (registration.captureExceptions ?? true) {
      providers.push({ provide: APP_FILTER, useClass: ObservabilityExceptionFilter });
    }

    return {
      module: ObservabilityModule,
      providers,
      exports: [OBSERVABILITY_OPTIONS, OBSERVABILITY_LOGGER, ObservabilityLogger],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    if (this.options.transports.includes("http")) {
      consumer.apply(RequestContextMiddleware).forRoutes("*");
    }
  }
}
