// Manual live-model verification only; the address source is an isolated synthetic fixture.
import readline from 'node:readline';import {makeBroker} from './tool-fixture.mjs';
const broker=makeBroker();
for await(const line of readline.createInterface({input:process.stdin,crlfDelay:Infinity})){
 try{const input=JSON.parse(line);if(input.commit){broker.commit(input.commit);process.stdout.write('{}\n');continue;}const result=await broker.invoke(input);process.stdout.write(JSON.stringify(result)+'\n');}
 catch{process.stdout.write(JSON.stringify({error:'Synthetic broker failed'})+'\n');}
}
