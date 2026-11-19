begin;
do $trial$
declare actor_id uuid; office_a uuid; office_b uuid; movement jsonb; receipt uuid; token uuid; res jsonb; qty int; n int; kind text; chosen uuid; stock_id uuid;
begin
 select id into strict actor_id from public.user_profiles where full_name='Maia Dolidze' and is_active and is_approved;
 select id into strict office_a from public.offices where name='Brick';
 select id into strict office_b from public.offices where name='Barnegat';
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor_id,'role','authenticated')::text,true);
 if (select count(*) from public.clinical_scan_offices())<>4 then raise exception 'Maia offices'; end if;
 foreach kind in array array['graft','implant'] loop
   foreach chosen in array array[office_a,office_b] loop
     movement:=jsonb_build_object('office',chosen,'category',kind,'action','receive','quantity',3,'identifier','SYNTHETIC-SCAN-QA','lot','SYNTHETIC-LOT','product','Synthetic QA','type','Bone','method','photo','sku','TEST-REF','expiry','2030-12-04','detailsConfirmed',true,'system','TEST-SYSTEM','platform','3.5 mm','diameter','3.7 mm','length','10 mm','manufacturer','Test Bank','size','15 × 20 mm','volume','0.5','volumeUnit','cc','particleSize','250–1000 µm','donor','DONOR-TEST');
     receipt:=gen_random_uuid();
     res:=public.record_clinical_office_scan_v2(movement,receipt);
     if (res->>'onHand')::int<>3 or public.record_clinical_office_scan_v2(movement,receipt)<>res then raise exception 'Receive replay'; end if;
     select m.stock_id into strict stock_id from clinical_scan.movements m where m.id=receipt;
     if public.clinical_scan_package_details(chosen,kind,stock_id)->>'sku'<>'TEST-REF' then raise exception 'Reference was not stored'; end if;
     if kind='implant' and (select length_label from public.implant_inventory where id=stock_id)<>'10 mm' then raise exception 'Implant size missing'; end if;
     if kind='graft' and (select donor_id from public.bone_tissue_stock where id=stock_id)<>'DONOR-TEST' then raise exception 'Donor missing'; end if;
     begin
       perform public.record_clinical_office_scan_v2(movement||jsonb_build_object('sku','WRONG-REF'),gen_random_uuid());
       raise exception 'Conflicting metadata accepted';
     exception when raise_exception then if sqlerrm not like 'Package sku conflicts%' then raise; end if; end;
     begin
       perform public.record_clinical_office_scan_v2(movement||jsonb_build_object('detailsConfirmed',false),gen_random_uuid());
       raise exception 'Unconfirmed metadata accepted';
     exception when raise_exception then if sqlerrm not like 'Confirm the product%' then raise; end if; end;

   end loop;
   token:=public.issue_clinical_scan_confirmation(actor_id,office_a,jsonb_build_object('appointmentId','SYNTHETIC-ONLY','patientId','QA','providerId','QA','providerName','Synthetic Test','patientName','Inventory Test','date',current_date));
   movement:=movement||jsonb_build_object('office',office_a,'action','consume','quantity',2,'confirmation',token);
   receipt:=gen_random_uuid();
   res:=public.record_clinical_office_scan_v2(movement,receipt);
   if (res->>'onHand')::int<>1 or public.record_clinical_office_scan_v2(movement,receipt)<>res then raise exception 'Consume replay'; end if;
   if (select on_hand from public.clinical_scan_stock(office_b,kind,'SYNTHETIC-SCAN-QA','SYNTHETIC-LOT'))<>3 then raise exception 'Other office stock changed'; end if;
   select cardinality(usage_ids) into n from clinical_scan.movements where id=receipt;
   if n<>(case when kind='implant' then 2 else 1 end) then raise exception 'Wrong usage count'; end if;
   begin
     perform public.record_clinical_office_scan_v2(movement,gen_random_uuid());
     raise exception 'Reused ticket passed';
   exception when raise_exception then if sqlerrm<>'Find and confirm this office visit again' then raise; end if; end;
   token:=public.issue_clinical_scan_confirmation(actor_id,office_a,jsonb_build_object('appointmentId','SYNTHETIC-ONLY','patientId','QA','providerName','Synthetic Test','date',current_date));
   movement:=movement||jsonb_build_object('confirmation',token,'quantity',1);
   begin perform public.record_clinical_office_scan_v2(movement,gen_random_uuid());raise exception 'Second submission accepted'; exception when raise_exception then if sqlerrm not like 'Already recorded for this visit and lot: 2%' then raise; end if; end;
   movement:=movement||jsonb_build_object('priorUnits',2,'quantity',2);
   begin perform public.record_clinical_office_scan_v2(movement,gen_random_uuid());raise exception 'Overdraw accepted'; exception when raise_exception then if sqlerrm<>'Insufficient stock in this office' then raise; end if; end;
   if (select on_hand from public.clinical_scan_stock(office_a,kind,'','SYNTHETIC-LOT'))<>1 then raise exception 'Failed transaction changed stock'; end if;
 end loop;

 foreach kind in array array['Tissue','Membrane'] loop
   movement:=jsonb_build_object('office',office_a,'category','graft','action','receive','quantity',1,
     'identifier','SYNTHETIC-'||kind,'lot','SYNTHETIC-'||kind,'product','Synthetic '||kind,'type',kind,
     'method','manual','sku','QA-'||kind,'expiry','2030-12-04','detailsConfirmed',true,'manufacturer','Test Bank','size','15 × 20 mm','donor','DONOR-TEST');
   receipt:=gen_random_uuid();res:=public.record_clinical_office_scan_v2(movement,receipt);
   select m.stock_id into strict stock_id from clinical_scan.movements m where m.id=receipt;
   if public.clinical_scan_package_details(office_a,'graft',stock_id)->>'size'<>'15 × 20 mm' then raise exception 'Tissue dimensions missing'; end if;
   if public.record_clinical_office_scan_v2(movement,receipt)<>res then raise exception 'Tissue replay'; end if;
 end loop;
 perform set_config('request.jwt.claims','{}',true);
 begin perform public.clinical_scan_stock(office_a,'graft','SYNTHETIC-SCAN-QA','');raise exception 'Unauthorized stock read'; exception when insufficient_privilege then null; end;
 if has_function_privilege('authenticated','public.issue_clinical_scan_confirmation(uuid,uuid,jsonb)','EXECUTE') or has_function_privilege('anon','public.record_clinical_office_scan_v2(jsonb,uuid)','EXECUTE') then raise exception 'Public scan or confirmation access'; end if;
end $trial$;
select 'PASS: metadata, replay, office separation, consume, overdraw, permissions; all rolled back' as result;
rollback;
