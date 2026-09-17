const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend'),runtime=process.env.NDASH_PARSER_ROOT||root;
const parser=require(path.join(runtime,'node_modules/@babel/parser')),esbuild=require(path.join(runtime,'node_modules/esbuild'));
const source=fs.readFileSync(path.join(root,'src/pages/implant-inventory-management/components/AddImplantModal.jsx'),'utf8');
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
const ast=parser.parse(source,{sourceType:'module',plugins:['jsx']});
const preview=find(ast,n=>n.type==='LogicalExpression'&&n.operator==='&&'&&n.left.name==='attachPreview');
const flag=find(ast,n=>n.type==='VariableDeclarator'&&n.id.name==='isPdfAttachment');
const compiled=esbuild.transformSync('('+source.slice(preview.start,preview.end)+')',{loader:'jsx',jsxFactory:'React.createElement'}).code;
function render(file,stored,previewUrl='https://qa.example/short-lived-file'){
 const context={attachFile:file,form:{attachment_url:stored},attachPreview:previewUrl,React:{createElement:(type,props,...children)=>({type,props,children})}};
 if(flag)context.isPdfAttachment=vm.runInNewContext(source.slice(flag.init.start,flag.init.end),context);
 return vm.runInNewContext(compiled,context);
}
for(const [name,file,stored] of [
 ['new PDF',{name:'QA.pdf',type:'application/pdf'},''],
 ['new PDF without browser MIME',{name:'QA.PDF',type:''},''],
 ['stored PDF',null,'qa-user/fixture.pdf'],
 ['stored PDF URL with query',null,'https://qa.invalid/fixture.PDF?token=example'],
])test(name+' has an open link instead of an image',()=>{const r=render(file,stored);assert.equal(r.type,'a');assert.equal(r.props.href,'https://qa.example/short-lived-file');assert.equal(r.props.target,'_blank');assert.match(r.props.rel,/noopener/);assert.match(r.children.join(''),/Open PDF attachment/);});
for(const [name,file,stored] of [['new image replacing PDF',{name:'QA.png',type:'image/png'},'old.pdf'],['stored image',null,'qa-user/fixture.jpg']])test(name+' retains image preview',()=>{const r=render(file,stored);assert.equal(r.type,'img');assert.equal(r.props.alt,'Attachment preview');});
test('absent or inaccessible attachment creates no open link',()=>assert.equal(render(null,'qa-user/file.pdf',null),null));
