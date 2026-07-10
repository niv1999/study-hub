use sand_box;


drop table if exists health_plan;

CREATE TABLE health_plan (
    emp_ssn CHAR(9),
    provider VARCHAR(20) NOT NULL,
    FOREIGN KEY (emp_ssn)
        REFERENCES employee (emp_ssn)
        ON DELETE CASCADE ON UPDATE CASCADE
);

insert into health_plan values(666,'AI');
insert into health_plan values(777,'AI');


select * from health_plan;
select * from employee;


delete from  employee where emp_id = 1;

select * from health_plan;
select * from employee;


update employee
set emp_ssn = 8
where EMP_ID = 2;