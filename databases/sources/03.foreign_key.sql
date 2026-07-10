use sand_box;

drop table if exists employee;

CREATE TABLE employee (
    emp_id INT PRIMARY KEY,
    emp_ssn CHAR(9) NOT NULL UNIQUE,
    emp_name VARCHAR(40) NOT NULL,
    pay_rate NUMERIC(5 , 2 ) NOT NULL,
    CHECK (pay_rate > 5.25)
);


drop table if exists health_plan;
drop table if exists health_plan_2;


CREATE TABLE health_plan (
    emp_ssn CHAR(9) PRIMARY KEY,
    provider VARCHAR(20) NOT NULL,
    FOREIGN KEY (emp_ssn)
        REFERENCES employee (emp_ssn)
);



CREATE TABLE health_plan_2 (
emp_ssn	CHAR(9)	 ,
provider VARCHAR(20) NOT NULL,
FOREIGN KEY (emp_ssn) REFERENCES employee (emp_ssn)
);




select * from employee;
insert into employee values(1,666,'Jane Doe',6);
insert into employee values(2,777,'Jhone Doe',5.5);

select * from health_plan;

insert into health_plan values(666,'AI');
insert into health_plan values(777,'AI');

insert into health_plan values(1,'AI');

insert into health_plan values(NULL,'AI');

update health_plan
set emp_ssn = 8
where emp_ssn = 666;


