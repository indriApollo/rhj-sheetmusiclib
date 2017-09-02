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
