// Explicitly synthetic, isolated test source. Never used by the production build.
import {AddressConversation,streetNameScore} from '../dist/resolver.mjs';
import {parseCSV} from '../dist/lookup.mjs';
import {addressTools} from './address-tools.mjs';
import {AddressToolSession} from '../dist/address-tools.mjs';
export const syntheticRecords=parseCSV('street,city,state,postal_code,property_value\n3220 Mint Drive,Fixture City,TX,00000,100\n3221 Mint Drive,Other Fixture,TX,00001,200\n50 Smith Avenue,Fixture City,TX,00000,300\n50 Smith Avenue,Other Fixture,TX,00001,350\n70 Zero Way,Fixture City,TX,00000,0\n80 Conflict Road,Fixture City,TX,00000,100\n80 Conflict Road,Fixture City,TX,00000,200').records;
export const syntheticSource={info:()=>({}),load:async house=>syntheticRecords.filter(r=>r.streetKey.split(' ')[0]===house),recommend:async({house,name})=>syntheticRecords.filter(r=>(!house||r.streetKey.split(' ')[0].startsWith(house))&&streetNameScore(name,new AddressConversation([]).parse(r.street,'source',[r.cityKey]).name||'')>0)};
export function makeBroker(){return new AddressToolSession({request:async(path,init)=>addressTools(new Request('https://synthetic.example'+path,{...init,headers:{...init.headers,Origin:'https://synthetic.example','oai-authenticated-user-id':'synthetic-user'}}),{},syntheticSource)});}
