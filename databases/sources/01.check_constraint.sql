use sand_box;

DROP TABLE IF EXISTS employee;
DROP TABLE IF EXISTS employee_with_status;
DROP TABLE IF EXISTS elevetor_check;


CREATE TABLE employee (
emp_id	INT	PRIMARY KEY,  
emp_ssn	CHAR(9)	 UNIQUE,  
emp_name VARCHAR(40)	NOT NULL,
pay_rate NUMERIC(5,2) NOT NULL,
CHECK (pay_rate > 5.25)
);

insert into employee values(1,666,'Jane Doe',6);
insert into employee values(2,777,'Jhone Doe',3);

desc employee;


select * from employee;


CREATE TABLE employee_with_status (
emp_id	INT	PRIMARY KEY,  
emp_ssn	CHAR(9)	NOT NULL UNIQUE,  
emp_name VARCHAR(40)	NOT NULL,
status VARCHAR(40)	NOT NULL,
pay_rate NUMERIC(5,2) NOT NULL,
CHECK (pay_rate > 5.25),
CHECK (status IN
('active', 'vacation', 'suspended'))
);


insert into employee_with_status values(1,666,'Jane Doe','vacation',6);
insert into employee_with_status values(2,777,'Jane Doe','WORKING',6);

SELECT * FROM employee_with_status;