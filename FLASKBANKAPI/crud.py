#!/usr/bin/python3

import pymysql

def database():
    global db, curseur
    db = pymysql.connect(host="localhost",user="root",password="Password",database="BankFastAPI" )
    curseur = db.cursor()


def creation_customer(first_name, last_name, email, address, phone, early_earnings, ufin, balance):
    database()
    sql="INSERT INTO customers (first_name, last_name, email, address, phone, early_earnings, ufin, balance) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"
    val=(first_name, last_name, email, address, phone, early_earnings, ufin, balance)
    curseur.execute(sql, val)
    db.commit()
    return "Customer created successfully"


def creation_transaction(trx_type, trx_date, trx_sign, merchant_name, merchant_location, price, owner_id):
    database()
    sql="INSERT INTO transactions (trx_type, trx_date, trx_sign, merchant_name, merchant_location, price, owner_id) VALUES (%s, %s, %s, %s, %s, %s, %s)"
    val=(trx_type, trx_date, trx_sign, merchant_name, merchant_location, price, owner_id)
    curseur.execute(sql, val)
    db.commit()
    return "Transaction created successfully"

def update_customer(first_name, last_name, email, address, phone, early_earnings, ufin, balance, id):
    database()
    sql="UPDATE customers SET first_name=%s, last_name=%s, email=%s, address=%s, phone=%s, early_earnings=%s, ufin=%s, balance=%s WHERE id=%s"
    val=(first_name, last_name, email, address, phone, early_earnings, ufin, balance, id)
    curseur.execute(sql, val)
    db.commit()
    return "Customer updated successfully"

def update_transaction(trx_type, trx_date, trx_sign, merchant_name, merchant_location, price, owner_id, id):    
    database()
    sql="UPDATE transactions SET trx_type=%s, trx_date=%s, trx_sign=%s, merchant_name=%s, merchant_location=%s, price=%s, owner_id=%s WHERE id=%s"
    val=(trx_type, trx_date, trx_sign, merchant_name, merchant_location, price, owner_id, id)
    curseur.execute(sql, val)
    db.commit()
    return "Transaction updated successfully"


def paiement_transaction(id, amount):
    """
    Perform a payment transaction for a customer.

    Args:
        id (int): The ID of the customer.
        amount (float): The amount to be paid.

    Returns:
        str: A message indicating the status of the payment transaction.
            - "Payment successful" if the payment was successful.
            - "Insufficient funds" if the customer's balance is not enough for the payment.
    """
    database()
    sql="SELECT balance FROM customers WHERE id=%s"
    val=(id,)
    curseur.execute(sql, val)
    result = curseur.fetchall()
    balance = result[0][0]
    if balance >= amount:
        balance = balance - amount
        sql="UPDATE customers SET balance=%s WHERE id=%s"
        val=(balance, id)
        curseur.execute(sql, val)
        db.commit()
        return "Payment successful"
    else:
        return "Insufficient funds"
    
    

def delete_customer(id):
    database()
    sql="DELETE FROM customers WHERE id=%s"
    val=(id,)
    curseur.execute(sql, val)
    db.commit()
    return "Customer deleted successfully"

def delete_transaction(id):        
    database()
    sql="DELETE FROM transactions WHERE id=%s"
    val=(id,)
    curseur.execute(sql, val)
    db.commit()
    return "Transaction deleted successfully"




#creation_customer("John", "Doe", "johndo@gmail.com", "5th Avenue", "221777777", 25000000, "123456789", 250000)
#creation_transaction("Credit", "2021-05-12", "C", "Amazon", "USA", 5000, 1)
#creation_transaction("Debit", "2021-05-12", "D", "Apple", "USA", 2000, 1)
#creation_transaction("Credit", "2021-05-12", "C", "Google", "USA", 3000, 1)
#creation_transaction("Debit", "2021-05-12", "D", "Facebook", "USA", 1000, 1)


def read_customers():
    database()
    curseur.execute("SELECT * FROM customers")
    result = curseur.fetchall()
    return result



def read_transactions():
    database()
    curseur.execute("SELECT * FROM transactions")
    result = curseur.fetchall()
    return result

