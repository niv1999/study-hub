use sand_box;

drop table if exists  elevetor_check;
drop table if exists employee;
drop table if exists elevator;
drop table if exists building;



create table building (
	building_no int, 
    building_name varchar(45),
    primary key(building_no)
);
create table elevator (
	elevator_no int,
    capacity int,
    building_no int,
    foreign key (building_no) references building (building_no),
    primary key(elevator_no)
);
-- drop table elevator;
create table employee (
	staff_no int,
    first_name varchar(45),
    last_name varchar(45),
    primary key (staff_no)
);
-- drop table employee;

create table elevetor_check (
	elevator_no int,
    staff_no int,
    date_examined date,
	foreign key(elevator_no) references elevator(elevator_no),
	foreign key(staff_no) references employee(staff_no),
    primary key(elevator_no, staff_no, date_examined)
);

-- drop table elevetor_check;

insert into building (building_no, building_name) values (1, 'Arthium'), (3, 'Azrieli') ;
insert into elevator (elevator_no, capacity, building_no) values (3, 15 , 1), (6, 15 , 1),(18, 20 , 3),(16, 12 , 3);
insert into employee (staff_no, first_name, last_name) values (1, 'Moshe' , 'Oren'), (4, 'Amir' , 'Doron');
insert into elevetor_check (elevator_no, staff_no, date_examined) values (3, 1 , now()), (6, 1 , now()),(18, 4 , now()),(16, 4 , now());

-- General Selects
select * from elevator;
select * from elevetor_check;
select * from employee;
select * from building;

SELECT 
    e.elevator_no,
    b.building_no,
    b.building_name,
    e.capacity,
    em.staff_no,
    em.first_name,
    em.last_name,
    ec.date_examined
FROM
    elevator e
        INNER JOIN
    elevetor_check ec on ec.elevator_no = e.elevator_no
        INNER JOIN
    building b on b.building_no = e.building_no
        INNER JOIN
    employee em on em.staff_no = ec.staff_no;