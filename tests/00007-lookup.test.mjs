// All records in this suite are synthetic, isolated test fixtures; never operational data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,addressQuery,parseCSV,search,money} from '../dist/lookup.mjs';
const header='street,city,state,postal_code,property_value\n';
const synthetic=header+'100 EXAMPLE ST,EXAMPLE CITY,Texas,00000,123456\n200 EXAMPLE DR,EXAMPLE CITY,Texas,00000,78900\n100 EXAMPLE ST,OTHER EXAMPLE,Texas,00001,456789\n300 SAMPLE AVE,null,Texas,null,100000\n';
test('00007 normalizes address abbreviations and leading speech numbers',()=>{
  assert.equal(normalize('1103 Egan Street, Texas'),'1103 egan st tx');
  assert.equal(normalize('one one zero three Egan Street'),'1103 egan st');
  assert.equal(normalize('eleven oh three Egan Street'),'1103 egan st');
  assert.equal(normalize('eleven hundred three Egan Street'),'1103 egan st');
  assert.equal(normalize('thirty two twenty Mint Drive'),'3220 mint dr');
  assert.equal(normalize('six hundred one Adams Avenue'),'601 adams ave');
  assert.equal(addressQuery('What is the valuation of 100 Example Street?'),'100 Example Street');
});
test('00007 returns unique exact address, city disambiguates and numeric mismatch never substitutes',()=>{
  const {records}=parseCSV(synthetic);
  assert.equal(search(records,'200 Example Drive').kind,'exact');
  assert.equal(search(records,'100 Example St').kind,'choose');
  const exact=search(records,'100 Example Street, Example City, Texas, 00000');
  assert.equal(exact.kind,'exact');assert.equal(exact.matches[0].values[0],123456);
  assert.equal(search(records,'201 Example Dr').kind,'none');
  assert.equal(search(records,'100 Exam').kind,'choose');
  assert.equal(search(records,'00000').total,2);
  assert.equal(search(records,'00001').kind,'choose');
  assert.equal(search(records,'').kind,'empty');
});
test('00007 CSV preserves quoted fields, nulls, zero and BOM',()=>{
  const {records}=parseCSV('\uFEFF'+header+'"1 EXAMPLE, UNIT 2",null,Texas,null,0\r\n');
  assert.equal(records[0].street,'1 EXAMPLE, UNIT 2');assert.equal(records[0].city,'');assert.equal(records[0].postal_code,'');assert.deepEqual(records[0].values,[0]);
  assert.equal(money(1234),'$1,234');
});
test('00007 combines repeats while retaining conflict values and exclusion counts',()=>{
  const {records,stats}=parseCSV(header+'100 EXAMPLE ST,EXAMPLE CITY,Texas,00000,100\n100 EXAMPLE ST,EXAMPLE CITY,Texas,00000,100\n100 EXAMPLE ST,EXAMPLE CITY,Texas,00000,200\nnull,null,Texas,null,100\n400 EXAMPLE ST,null,Texas,null,unknown\n');
  assert.equal(records.length,1);assert.deepEqual(records[0].values,[100,200]);assert.equal(stats.conflicts,1);assert.equal(stats.duplicates,1);assert.equal(stats.missingStreet,1);assert.equal(stats.invalidValue,1);assert.equal(stats.sourceRows,5);
});
test('00007 rejects malformed or unusable CSV rather than inventing data',()=>{
  assert.throws(()=>parseCSV('address,value\n1 EXAMPLE,1'),/CSV needs/);
  assert.throws(()=>parseCSV(header+'"unclosed'),/unclosed/);
  assert.throws(()=>parseCSV(header+'1 EXAMPLE,city,Texas,00000,1,extra'),/number of columns/);
  assert.throws(()=>parseCSV(header+'null,null,null,null,50'),/No usable/);
});
test('00007 never treats CSV markup or text as executable instructions',()=>{
  const {records}=parseCSV(header+'<script>example</script>,EXAMPLE CITY,Texas,00000,100');
  assert.equal(records[0].street,'<script>example</script>');
});
