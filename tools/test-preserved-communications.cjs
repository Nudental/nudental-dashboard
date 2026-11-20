const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),test=require('node:test');
const source=fs.readFileSync('recovered-frontend/src/config/navConfig.js','utf8').replace(/^export /gm,'');
const nav=vm.runInNewContext(source+';({isNavItemVisible,ROUTE_TO_NAV})');
test('published communications tabs retain administrator and exact Ny access',()=>{
  for(const id of ['office-texts','internal-campaigns']){
    const item=nav.ROUTE_TO_NAV['/'+id];assert.ok(item);
    assert.equal(nav.isNavItemVisible(item,{role:'super_admin'},()=>false),true);
    assert.equal(nav.isNavItemVisible(item,{role:'regional_manager',id:'2954e9e7-9b8a-4ed3-a624-71f91c36d2c3',email:'ny@thenudental.com'},()=>false),true);
    for(const user of [{role:'office_manager'},{role:'staff'},{role:'regional_manager',email:'ny@thenudental.com',id:'different'}])
      assert.equal(nav.isNavItemVisible(item,user,()=>true),false);
  }
});
