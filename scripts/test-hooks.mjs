/**
 * Registers the resolver in scripts/test-resolve.mjs on the module loader
 * thread. `--import` this from the `test` script; see that file for why.
 */
import { register } from "node:module";

register("./test-resolve.mjs", import.meta.url);
