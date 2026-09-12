const fs=require('fs'),path=require('path'),assert=require('assert/strict'),parser=require('./phase4/rocket-source/node_modules/@babel/parser'),traverse=require('./phase4/rocket-source/node_modules/@babel/traverse').default;
const component=fs.readFileSync(path.join(__dirname,'phase4-ndash065-component-after.js'),'utf8'),s='('+component+')';let table,older;
traverse(parser.parse(s),{CallExpression(p){if(p.node.arguments[0]?.value==='table'){assert(!table);table=p;}}});assert(table);table.traverse({MemberExpression(p){if(p.node.computed&&p.node.property?.type==='BinaryExpression'&&p.node.property.operator==='-'&&p.node.property.right.value===1){assert(!older);older=p.node;}}});assert(older&&older.object.type==='Identifier');const years=older.object.name,edits=[];
table.traverse({
  CallExpression(p) {
    if(p.node.callee.property?.name!=='map'||p.node.callee.object?.name!==years)return;
    const cb=p.node.arguments[0];
    assert(cb?.type==='ArrowFunctionExpression'&&cb.params.length===2);
    const idx=cb.params[1];
    p.traverse({
      BinaryExpression(q) {
        if(q.node.operator==='>'&&q.node.left.name===idx.name&&q.node.right.value===0&&q.scope.getBinding(idx.name)?.identifier===idx)
          edits.push({node:q.node,text:idx.name+'<'+years+'.length-1'});
      }
    });
  }
});
assert.equal(edits.length,2);edits.push({node:older.property,text:older.property.left.name+'+1'});
const before=s.slice(table.node.start,table.node.end);let after=before;for(const e of edits.sort((a,b)=>b.node.start-a.node.start))after=after.slice(0,e.node.start-table.node.start)+e.text+after.slice(e.node.end-table.node.start);parser.parse(after);
for(const [name,text] of Object.entries({'table-before':before,'table-after':after}))fs.writeFileSync(path.join(__dirname,'phase4-ndash066-'+name+'.js'),text);
const componentAfter=component.slice(0,table.node.start-1)+after+component.slice(table.node.end-1);fs.writeFileSync(path.join(__dirname,'phase4-ndash066-component-after.js'),componentAfter);
fs.writeFileSync(path.join(__dirname,'phase4-ndash066-patch-evidence.json'),JSON.stringify({tableBytes:before.length,comparisonGuards:2,olderHeaderOffsetChanges:1,sortedYearsAlias:years}));
console.log(JSON.stringify({tableBytes:before.length,threeExpressionsOnly:true}));
require('./phase4-version-graph.cjs')({issue:'066',previous:'065',deployment:'8afdd341-91fb-4509-9727-76d98c62b03e',target:'ndash065-GustoTimeAndAttendance.js',targetPatches:[],mainPatches:[{old:before,new:after}]});
