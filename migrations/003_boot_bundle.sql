-- 부팅 때 따로 받던 작은 표 29개를 한 번에 돌려준다(2026-10-14). 키 = 앱 sbGet의 'table?params' 그대로.
-- SECURITY INVOKER(기본) — 부른 역할(anon)의 권한·RLS 그대로라 권한 범위는 개별 조회와 같다.
-- ★로더의 sbGet 파라미터를 바꾸면 여기 키도 같이 바꿀 것(supabase-client.js BOOT_BUNDLE_KEYS와 짝).
create or replace function public.boot_bundle()
returns json language sql stable set search_path = public as $$
  select json_build_object(
    'farms?order=name', coalesce((select json_agg(t order by name) from farms t), '[]'::json),
    'drivers?order=display_order.asc.nullslast,id.asc', coalesce((select json_agg(t order by display_order asc nulls last, id asc) from drivers t), '[]'::json),
    'dispatches?order=date.desc,created_at.desc', coalesce((select json_agg(t order by date desc, created_at desc) from dispatches t), '[]'::json),
    'picks?order=date.desc,created_at.desc', coalesce((select json_agg(t order by date desc, created_at desc) from picks t), '[]'::json),
    'own_ins?order=date.desc', coalesce((select json_agg(t order by date desc) from own_ins t), '[]'::json),
    'own_outs?order=date.desc', coalesce((select json_agg(t order by date desc) from own_outs t), '[]'::json),
    'nhf_ins?order=date.desc', coalesce((select json_agg(t order by date desc) from nhf_ins t), '[]'::json),
    'nhf_outs?order=date.desc', coalesce((select json_agg(t order by date desc) from nhf_outs t), '[]'::json),
    'reports?order=date.desc,created_at.desc', coalesce((select json_agg(t order by date desc, created_at desc) from reports t), '[]'::json),
    'harvests?order=date', coalesce((select json_agg(t order by date) from harvests t), '[]'::json),
    'vehicles?order=number', coalesce((select json_agg(t order by number) from vehicles t), '[]'::json),
    'storage_locations?order=sort_order,name', coalesce((select json_agg(t order by sort_order, name) from storage_locations t), '[]'::json),
    'partners?order=sort_order.asc,name.asc', coalesce((select json_agg(t order by sort_order asc, name asc) from partners t), '[]'::json),
    'manual_transactions?is_void=eq.false&order=date.desc,created_at.desc', coalesce((select json_agg(t order by date desc, created_at desc) from manual_transactions t where is_void = false), '[]'::json),
    'container_types?order=sort_order.asc,id.asc', coalesce((select json_agg(t order by sort_order asc, id asc) from container_types t), '[]'::json),
    'pachi_usages?order=sort_order', coalesce((select json_agg(t order by sort_order) from pachi_usages t), '[]'::json),
    'brix_grades?order=sort_order', coalesce((select json_agg(t order by sort_order) from brix_grades t), '[]'::json),
    'pachi_sizes?order=sort_order', coalesce((select json_agg(t order by sort_order) from pachi_sizes t), '[]'::json),
    'pachi_conditions?order=sort_order', coalesce((select json_agg(t order by sort_order) from pachi_conditions t), '[]'::json),
    'quality_criteria?order=product_name', coalesce((select json_agg(t order by product_name) from quality_criteria t), '[]'::json),
    'categories?order=id', coalesce((select json_agg(t order by id) from categories t), '[]'::json),
    'size_grades?order=sort_order', coalesce((select json_agg(t order by sort_order) from size_grades t), '[]'::json),
    'items?order=name', coalesce((select json_agg(t order by name) from items t), '[]'::json),
    'item_size_rules?order=item_id,min_su', coalesce((select json_agg(t order by item_id, min_su) from item_size_rules t), '[]'::json),
    'juice_batches?is_void=eq.false&order=inbound_date.desc,created_at.desc', coalesce((select json_agg(t order by inbound_date desc, created_at desc) from juice_batches t where is_void = false), '[]'::json),
    'juice_product_master?is_active=eq.true&order=product_name', coalesce((select json_agg(t order by product_name) from juice_product_master t where is_active = true), '[]'::json),
    'processing_records?order=date.desc,created_at.desc', coalesce((select json_agg(t order by date desc, created_at desc) from processing_records t), '[]'::json),
    'inventory_records?or=(is_void.eq.false,is_void.is.null)&order=date.desc,created_at.desc', coalesce((select json_agg(t order by date desc, created_at desc) from inventory_records t where is_void = false or is_void is null), '[]'::json),
    'inbound_records?select=*,driver:drivers(name,type)&order=date.desc,created_at.desc', coalesce((
       select json_agg(x order by x.date desc, x.created_at desc) from (
         select i.*, (select row_to_json(d)::jsonb from (select dr.name, dr.type from drivers dr where dr.id = i.driver_id) d) as driver
         from inbound_records i) x), '[]'::json)
  );
$$;
grant execute on function public.boot_bundle() to anon, authenticated;
notify pgrst, 'reload schema';
