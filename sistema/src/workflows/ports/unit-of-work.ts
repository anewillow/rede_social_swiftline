export interface UnitOfWork<Scope> {
  run(operation: (scope: Scope) => Promise<void>): Promise<void>;
}

export interface AtomicUnitOfWork<Scope> {
  run<Result>(operation: (scope: Scope) => Promise<Result>): Promise<Result>;
}
