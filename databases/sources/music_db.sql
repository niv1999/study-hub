-- ============================================
-- Music Database Schema
-- Generated from ERD
-- ============================================

CREATE DATABASE IF NOT EXISTS music_db;
USE music_db;

-- ============================================
-- INDEPENDENT TABLES (no foreign keys)
-- ============================================

CREATE TABLE factory (
    factory_id   INT          NOT NULL AUTO_INCREMENT,
    factory_name VARCHAR(100) NOT NULL,
    PRIMARY KEY (factory_id)
);

CREATE TABLE track_type (
    type_id    INT          NOT NULL AUTO_INCREMENT,
    track_name VARCHAR(100) NOT NULL,
    PRIMARY KEY (type_id)
);

CREATE TABLE lyricist (
    lyricist_id INT         NOT NULL AUTO_INCREMENT,
    first_name  VARCHAR(50) NOT NULL,
    last_name   VARCHAR(50) NOT NULL,
    PRIMARY KEY (lyricist_id)
);

CREATE TABLE composer (
    composer_id INT         NOT NULL AUTO_INCREMENT,
    first_name  VARCHAR(50) NOT NULL,
    last_name   VARCHAR(50) NOT NULL,
    PRIMARY KEY (composer_id)
);

CREATE TABLE member_type (
    type_id   INT          NOT NULL AUTO_INCREMENT,
    type_name VARCHAR(100) NOT NULL,
    PRIMARY KEY (type_id)
);

-- ============================================
-- TABLES WITH FOREIGN KEYS
-- ============================================

CREATE TABLE instrument (
    instrument_id   INT          NOT NULL AUTO_INCREMENT,
    instrument_name VARCHAR(100) NOT NULL,
    instrument_type VARCHAR(100),
    factory_id      INT,
    PRIMARY KEY (instrument_id),
    CONSTRAINT fk_instrument_factory
        FOREIGN KEY (factory_id) REFERENCES factory(factory_id)
);

CREATE TABLE track (
    track_id    INT          NOT NULL AUTO_INCREMENT,
    track_name  VARCHAR(200) NOT NULL,
    track_type  INT,
    composer_id INT,
    lyricist_id INT,
    PRIMARY KEY (track_id),
    CONSTRAINT fk_track_type
        FOREIGN KEY (track_type)  REFERENCES track_type(type_id),
    CONSTRAINT fk_track_composer
        FOREIGN KEY (composer_id) REFERENCES composer(composer_id),
    CONSTRAINT fk_track_lyricist
        FOREIGN KEY (lyricist_id) REFERENCES lyricist(lyricist_id)
);

CREATE TABLE album (
    album_id   INT          NOT NULL AUTO_INCREMENT,
    album_name VARCHAR(200) NOT NULL,
    start_date DATE,
    end_date   DATE,
    PRIMARY KEY (album_id)
);

CREATE TABLE member (
    member_id   INT         NOT NULL AUTO_INCREMENT,
    member_type INT,
    first_name  VARCHAR(50) NOT NULL,
    last_name   VARCHAR(50) NOT NULL,
    birth_date  DATE,
    PRIMARY KEY (member_id),
    CONSTRAINT fk_member_type
        FOREIGN KEY (member_type) REFERENCES member_type(type_id)
);

-- ============================================
-- JUNCTION / WEAK TABLES
-- ============================================

CREATE TABLE album_track (
    album_id    INT  NOT NULL,
    track_id    INT  NOT NULL,
    update_date DATE,
    PRIMARY KEY (album_id, track_id),
    CONSTRAINT fk_album_track_album
        FOREIGN KEY (album_id) REFERENCES album(album_id),
    CONSTRAINT fk_album_track_track
        FOREIGN KEY (track_id) REFERENCES track(track_id)
);

CREATE TABLE phone (
    member_id    INT         NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    PRIMARY KEY (member_id, phone_number),
    CONSTRAINT fk_phone_member
        FOREIGN KEY (member_id) REFERENCES member(member_id)
);

CREATE TABLE member_instrument (
    member_id     INT NOT NULL,
    instrument_id INT NOT NULL,
    PRIMARY KEY (member_id, instrument_id),
    CONSTRAINT fk_member_instrument_member
        FOREIGN KEY (member_id)     REFERENCES member(member_id),
    CONSTRAINT fk_member_instrument_instrument
        FOREIGN KEY (instrument_id) REFERENCES instrument(instrument_id)
);

CREATE TABLE member_track (
    member_id INT NOT NULL,
    track_id  INT NOT NULL,
    PRIMARY KEY (member_id, track_id),
    CONSTRAINT fk_member_track_member
        FOREIGN KEY (member_id) REFERENCES member(member_id),
    CONSTRAINT fk_member_track_track
        FOREIGN KEY (track_id)  REFERENCES track(track_id)
);

