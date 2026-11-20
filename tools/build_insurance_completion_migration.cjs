// Keep the database and browser completion requirements in one reviewed registry.
const fs = require('node:fs');
const path = require('node:path');
const rules = [...require('../recovered-frontend/src/config/insuranceCompletionRules.json'),
  ...require('../recovered-frontend/src/config/insurancePlanEntryFields.json').map(({key, ...field}) => ({...field, path:'form_data.' + key}))];
const sql = `-- Generated from insuranceCompletionRules.json. Drafts and legacy completed records remain valid.
create or replace function insurance_internal.completion_errors(data jsonb)
returns jsonb language plpgsql immutable security invoker set search_path = '' as $fn$
declare
  rules constant jsonb := $rules$${JSON.stringify(rules)}$rules$::jsonb;
  rule jsonb; condition jsonb; value jsonb; raw text; explanation text; applies boolean; valid boolean;
  errors jsonb := '[]'::jsonb;
begin
  for rule in select * from jsonb_array_elements(rules) loop
    applies := not (rule ? 'when');
    if not applies then
      for condition in select * from jsonb_array_elements(rule->'when') loop
        value := data #> string_to_array(condition->>'path','.');
        raw := regexp_replace(coalesce(value #>> '{}',''),'^[[:space:]]+|[[:space:]]+$','','g');
        if condition ? 'eq' then
          applies := applies or coalesce(value = condition->'eq',false);
        elsif raw ~ '^[0-9]+(\\.[0-9]+)?$' then
          applies := applies or raw::numeric > (condition->>'gt')::numeric;
        end if;
      end loop;
    end if;
    if not applies then continue; end if;
    value := data #> string_to_array(rule->>'path','.');
    raw := regexp_replace(coalesce(value #>> '{}',''),'^[[:space:]]+|[[:space:]]+$','','g');
    explanation := regexp_replace(coalesce(data->'form_data'->'not_applicable'->>(rule->>'path'),''),'^[[:space:]]+|[[:space:]]+$','','g');
    if raw='' and jsonb_typeof(data->'form_data'->'not_applicable'->(rule->>'path'))='string' and length(explanation)>0 then continue; end if;
    valid := raw<>'';
    if valid then
      case rule->>'type'
        when 'text' then valid := jsonb_typeof(value)='string';
        when 'boolean' then valid := jsonb_typeof(value)='boolean';
        when 'enum' then valid := (rule->'options') @> jsonb_build_array(value);
        when 'checkboxes' then valid := value->'preventive'='true'::jsonb or value->'basic'='true'::jsonb or value->'major'='true'::jsonb;
        when 'number' then
          valid := jsonb_typeof(value) in ('number','string') and raw ~ '^[0-9]+(\\.[0-9]+)?$';
          if valid then valid := raw::numeric>=coalesce((rule->>'min')::numeric,0) and (not (rule ? 'max') or raw::numeric<=(rule->>'max')::numeric)
            and (not coalesce((rule->>'integer')::boolean,false) or trunc(raw::numeric)=raw::numeric); end if;
        when 'date' then
          valid := jsonb_typeof(value)='string' and raw ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';
          if valid then begin valid := to_char(raw::date,'YYYY-MM-DD')=raw; exception when others then valid:=false; end; end if;
        else valid := false;
      end case;
    end if;
    if not coalesce(valid,false) then errors := errors || jsonb_build_array(jsonb_build_object('path',rule->>'path','label',rule->>'label','section',rule->>'section')); end if;
  end loop;
  if coalesce(data->>'remaining_max','') ~ '^[0-9]+(\\.[0-9]+)?$' and coalesce(data->>'yearly_max','') ~ '^[0-9]+(\\.[0-9]+)?$' then
    if (data->>'remaining_max')::numeric>(data->>'yearly_max')::numeric then errors:=errors||jsonb_build_array(jsonb_build_object('path','remaining_max','label','Remaining maximum cannot exceed yearly maximum','section','C')); end if;
  end if;
  if coalesce(data->>'individual_deductible_remaining','') ~ '^[0-9]+(\\.[0-9]+)?$' and coalesce(data->>'deductible','') ~ '^[0-9]+(\\.[0-9]+)?$' then
    if (data->>'individual_deductible_remaining')::numeric>(data->>'deductible')::numeric then errors:=errors||jsonb_build_array(jsonb_build_object('path','individual_deductible_remaining','label','Remaining deductible cannot exceed the deductible','section','C')); end if;
  end if;
  if coalesce(data->>'term_date','')<>'' and coalesce(data->>'eff_date','')<>'' and data->>'term_date'<data->>'eff_date' then
    errors:=errors||jsonb_build_array(jsonb_build_object('path','term_date','label','Term date cannot precede effective date','section','B'));
  end if;
  if coalesce(data->'form_data'->>'family_deductible_remaining','') ~ '^[0-9]+(\\.[0-9]+)?$' and coalesce(data->>'family_deductible','') ~ '^[0-9]+(\\.[0-9]+)?$' then
    if (data->'form_data'->>'family_deductible_remaining')::numeric>(data->>'family_deductible')::numeric then errors:=errors||jsonb_build_array(jsonb_build_object('path','form_data.family_deductible_remaining','label','Remaining family deductible cannot exceed the family deductible','section','C')); end if;
  end if;
  return errors;
end; $fn$;
revoke all on function insurance_internal.completion_errors(jsonb) from public, anon;
grant execute on function insurance_internal.completion_errors(jsonb) to authenticated, service_role;

create or replace function insurance_internal.require_complete_breakdown()
returns trigger language plpgsql security invoker set search_path = '' as $fn$
declare errors jsonb;
begin
  if new.status='completed' and (tg_op='INSERT' or old.status is distinct from 'completed') then
    errors := insurance_internal.completion_errors(to_jsonb(new));
    if jsonb_array_length(errors)>0 then
      raise exception using errcode='23514',
        message='Complete the required insurance information: ' || (select string_agg(e->>'label',', ') from jsonb_array_elements(errors) e),
        detail=errors::text, hint='Answer each item, or record NA / unavailable for information that is not available. Blank answers can be saved as draft.';
    end if;
  end if;
  return new;
end; $fn$;
revoke all on function insurance_internal.require_complete_breakdown() from public, anon;
grant execute on function insurance_internal.require_complete_breakdown() to authenticated, service_role;
create trigger insurance_completion_required before insert or update on public.insurance_verifications
for each row execute function insurance_internal.require_complete_breakdown();
`;
if (!process.argv[2]) throw Error('Pass the migration path created by supabase migration new.');
fs.writeFileSync(path.resolve(process.argv[2]),process.argv.includes('--validation-only') ? sql.slice(0,sql.indexOf('create or replace function insurance_internal.require_complete_breakdown')) : sql);
