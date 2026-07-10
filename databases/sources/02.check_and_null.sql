use sand_box;

DROP TABLE IF EXISTS customer;

CREATE TABLE customer (
cust_name  VARCHAR(30) NOT NULL,  
address VARCHAR(60),
UNIQUE (cust_name, address)
);

INSERT INTO customer VALUES ('John Doe', '123 Spring Lane');
INSERT INTO customer VALUES ('John Doe', '123 Spring Lane');

INSERT INTO customer VALUES ('John Doe', NULL);
INSERT INTO customer VALUES ('John Doe', NULL);


select * from customer;


