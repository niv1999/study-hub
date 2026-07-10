USE sand_box;

drop table student_agg;

CREATE TABLE student_agg (
	student_id INT AUTO_INCREMENT, 
    student_name VARCHAR(10),
    phone_type VARCHAR(10),
    quantity INT,
    PRIMARY KEY (student_id)
);

INSERT INTO student_agg (student_name,phone_type,quantity) VALUES ('noam','iphone',1);
INSERT INTO student_agg (student_name,phone_type,quantity) VALUES ('ron','android',1);
INSERT INTO student_agg (student_name,phone_type,quantity) VALUES ('nikoli','samsung',1);
INSERT INTO student_agg (student_name,phone_type,quantity) VALUES ('kori','xiomi',1);
INSERT INTO student_agg (student_name,phone_type,quantity) VALUES ('yariv','xiomi',3);


SELECT * FROM student_agg;


SELECT COUNT(*) FROM student_agg;
SELECT SUM(quantity) FROM student_agg;

SELECT PHONE_TYPE,COUNT(*) FROM student_agg GROUP BY phone_type;
SELECT PHONE_TYPE,SUM(quantity) FROM student_agg GROUP BY phone_type;


select phone_type,sum(quantity) from student_agg 
where phone_type = 'xiomi'
group by phone_type;

select phone_type,avg(quantity) from student_agg 
-- where phone_type = 'xiomi'
 group by phone_type;


select phone_type,min(quantity) from student_agg 
-- where phone_type = 'xiomi'
 group by phone_type; 




-- insert into student_agg (student_agg_name,color,quantity) values ('Bne','blue',1);
-- insert into student_agg (student_agg_name,color,quantity) values ('Roni','pink',1);



truncate table student_agg;