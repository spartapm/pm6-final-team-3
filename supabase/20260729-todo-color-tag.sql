-- TO-DO checkbox color + single hashtag tag
alter table todos
  add column if not exists color text null;

alter table todos
  add column if not exists tag text null;

comment on column todos.color is 'Checkbox accent color hex, null means default';
comment on column todos.tag is 'Single hashtag label without # prefix';
