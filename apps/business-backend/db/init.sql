CREATE DATABASE SampleDB;
GO

USE SampleDB;
GO

CREATE TABLE Users (
    UserID INT PRIMARY KEY,
    UserName VARCHAR(50),
    Email VARCHAR(100)
);
GO

INSERT INTO Users (UserID, UserName, Email) VALUES
(1, 'John Doe', 'john.doe@example.com');
GO