declare module 'solc' {
  type SolcCallback = {
    import?: (path: string) => { contents?: string; error?: string }
  }
  type SolcCompiler = {
    compile: (input: string, callbacks?: SolcCallback) => string
  }
  const solc: SolcCompiler
  export default solc
}
