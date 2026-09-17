const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const deps=process.env.NDASH_PARSER_ROOT||path.join(__dirname,'../recovered-frontend');
const React=require(path.join(deps,'node_modules/react'));
const parser=require(path.join(deps,'node_modules/@babel/parser'));
const esbuild=require(path.join(deps,'node_modules/esbuild'));
const source=fs.readFileSync(path.join(__dirname,'../recovered-frontend/src/pages/bone-and-tissue-inventory/components/MobileEntryModal.jsx'),'utf8');
const ast=parser.parse(source,{sourceType:'module',plugins:['jsx']});
const body=ast.program.body.filter(n=>!['ImportDeclaration','ExportDefaultDeclaration'].includes(n.type)).map(n=>source.slice(n.start,n.end)).join('\n');
const code=esbuild.transformSync(body+'\nmodule.exports=MobileEntryModal;',{loader:'jsx',format:'cjs'}).code;
function fixture(edit=false){
 const values=[];let index=0;const module={exports:{}};
 const scanner=()=>null,blank=()=>null;
 vm.runInNewContext(code,{module,React,useRef:v=>({current:v}),useState(initial){const i=index++;if(!(i in values))values[i]=i===0?3:initial;return[values[i],v=>{values[i]=typeof v==='function'?v(values[i]):v}];},Icon:blank,MobileScannerPriority:scanner,TouchDropdown:blank,MobileDatePicker:blank,NumericKeypad:blank});
 function render(){index=0;return module.exports({record:edit?{id:'qa-fixture',identification_number:'QA-EXISTING'}:null,offices:[],providers:[],staff:[],userId:'qa-user',onClose:blank,onSaved:blank});}
 function nodes(tree,out=[]){if(!tree||typeof tree!=='object')return out;if(Array.isArray(tree)){tree.forEach(n=>nodes(n,out));return out;}out.push(tree);nodes(tree.props?.children,out);return out;}
 return{render,nodes,scanner};
}
for(const edit of [false,true])test(`Bone ${edit?'edit':'create'} product step starts with manual input and no scanner mount`,()=>{
 const f=fixture(edit),nodes=f.nodes(f.render());
 assert.equal(nodes.filter(n=>n.type===f.scanner).length,0,'Entering a form step must not request camera access');
 const input=nodes.find(n=>n.type==='input'&&n.props.placeholder==='Enter ID number');assert.ok(input);
 assert.equal(input.props.value,edit?'QA-EXISTING':'');
 assert.ok(nodes.some(n=>n.type==='button'&&JSON.stringify(n.props.children).includes('Switch to Scanner')));
});
test('explicit scanner choice and manual return remain available',()=>{
 const f=fixture(),nodes=f.nodes(f.render());
 const toggle=nodes.find(n=>n.type==='button'&&JSON.stringify(n.props.children).includes('Switch to Scanner'));assert.ok(toggle);toggle.props.onClick();
 const scanner=f.nodes(f.render()).find(n=>n.type===f.scanner);assert.ok(scanner);assert.equal(scanner.props.autoOpen,true);
 scanner.props.onManualEntry();assert.equal(f.nodes(f.render()).filter(n=>n.type===f.scanner).length,0);
});
