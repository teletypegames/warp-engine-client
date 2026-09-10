/**
 * What a build was branded with, if anything.
 *
 * A brand is data the build supplies — a name for the window and a catalog to install
 * first — never a store the code knows. Without one the client is the generic
 * WarpEngine Client and asks the registry.
 */
export interface Brand {
  readonly name: string
  readonly catalogUrl: string
}
