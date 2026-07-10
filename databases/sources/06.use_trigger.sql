use sand_box;

select * from employee;
select * from health_plan;
select * from pay_rate_log;
insert into employee values(3,888,'Jeff Working',5.5);

delete from employee where emp_id = 2;


select * from employee_log;

update employee
set pay_rate = 11
where emp_id = 3;



