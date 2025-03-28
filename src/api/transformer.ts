import { uneval } from 'devalue';
import SuperJSON from 'superjson';

const transformer_json_trpc = {
  input: SuperJSON,
  // superjson :- upload
  // devaule :- download
  output: {
    serialize: (object: any) => uneval(object),
    // This `eval` only ever happens on the **client**
    deserialize: (object: any) => eval(`(${object})`)
  }
};
export default transformer_json_trpc;
