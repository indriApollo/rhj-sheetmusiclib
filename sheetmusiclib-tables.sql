create table titles(
    id integer primary key,
    title text not null,
    CONSTRAINT title_unique UNIQUE (title)
);

create table instruments(
    id integer primary key,
    instrument text not null,
    CONSTRAINT instrument_unique UNIQUE (instrument)
);

create table tags(
    id integer primary key,
    tag text not null,
    CONSTRAINT tag_unique UNIQUE (tag)
);

create table title_tag_join(
    id integer primary key,
    titleId integer,
    tagId integer
);
