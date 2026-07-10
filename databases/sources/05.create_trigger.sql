use sand_box;

DROP TABLE IF EXISTS pay_rate_log;
CREATE TABLE pay_rate_log(emp_id int,old_pay_rate decimal(5,2),new_pay_rate decimal(5,2),change_time datetime default now());
CREATE TABLE employee_log(emp_id int,delete_by_user varchar(100),delete_time datetime default now());

select user();

DELIMITER $$
CREATE  TRIGGER ins_employee AFTER INSERT ON employee FOR EACH ROW BEGIN
    INSERT INTO health_plan (emp_ssn,provider)
        VALUES (new.emp_ssn,'AI');
  END;
 $$
DELIMITER ; 
  
  
  DELIMITER $$
  CREATE  TRIGGER upd_employee AFTER UPDATE ON employee FOR EACH ROW BEGIN
     IF (old.pay_rate != new.pay_rate)
     THEN
         INSERT INTO  pay_rate_log (emp_id, old_pay_rate, new_pay_rate)
             VALUES (old.emp_id,old.pay_rate,new.pay_rate);
     END IF;
   END;$$
DELIMITER ;


DROP TRIGGER ins_employee;


DELIMITER $$
  CREATE  TRIGGER del_employee AFTER DELETE ON employee FOR EACH ROW BEGIN

         INSERT INTO  employee_log (emp_id, delete_by_user, delete_time)
             VALUES (old.emp_id,user(),now());

   END;$$
DELIMITER ;
DROP TRIGGER del_employee;



show triggers;