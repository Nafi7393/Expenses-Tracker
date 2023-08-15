import bcrypt, os, calendar
from flask import Flask, render_template, request, jsonify, url_for, redirect, session
from flask_login import LoginManager, UserMixin, logout_user, login_required, login_user
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
from sqlalchemy import func, desc
from dotenv import load_dotenv
from dateutil.relativedelta import relativedelta

load_dotenv()


app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv("SUPER_SECRET_KEY")
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv("DATABASE_URL")
db = SQLAlchemy(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login'


class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)

    password = db.Column(db.String(100), nullable=False)
    expenses = db.relationship('Expense', backref='user', lazy=True)

    # Password hashing and verification methods
    def set_password(self, password):
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        self.password = hashed_password.decode('utf-8')

    def check_password(self, password):
        return bcrypt.checkpw(password.encode('utf-8'), self.password.encode('utf-8'))


class Expense(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    reason = db.Column(db.String(128), nullable=True, default=None)
    amount = db.Column(db.Float, nullable=True, default=None)
    date = db.Column(db.DateTime, nullable=False, default=datetime.now)

    # Add the 'month' and 'year' attributes
    month = db.Column(db.Integer)
    year = db.Column(db.Integer)


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html')


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        name = request.form['name']
        email = request.form['email']
        password = request.form['password']

        # Check if the email or name already exists in the database
        existing_user_email = User.query.filter_by(email=email).first()
        existing_user_name = User.query.filter_by(name=name).first()

        if existing_user_email:
            error = 'Email already exists. Please choose another email.'
            return render_template('register.html', error=error, error_type='email')
        elif existing_user_name:
            error = 'Name already exists. Please choose another name.'
            return render_template('register.html', error=error, error_type='name')

        # Create a new user
        new_user = User(name=name, email=email)
        new_user.set_password(password)  # Hash the password
        db.session.add(new_user)
        db.session.commit()

        return redirect(url_for('login'))
    else:
        return render_template('register.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']

        user = User.query.filter_by(email=email).first()

        today = datetime.now().date()
        formatted_date = today.strftime("%d-%m-%Y")
        day_name = today.strftime("%a")

        if user and user.check_password(password):
            login_user(user, remember=True)

            # Set user session
            session['user_id'] = user.id
            session['user_email'] = user.email
            session['user_name'] = user.name
            session['date'] = f"{formatted_date}: {day_name}"

            return redirect(url_for('dashboard'))
        return render_template('login.html', error='Invalid email or password')
    return render_template('login.html')


@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))


@login_required
@app.route('/add_expense', methods=['POST'])
def add_expense():
    try:
        data = request.json
        reason = data.get('reason')
        amount = data.get('amount')
        user_id = data.get('user_id')  # Add this line to get the user ID from the JSON data

        if reason is None or amount is None or user_id is None:
            return jsonify({'success': False, 'message': 'Please provide reason, amount, and user ID.'}), 400

        # Convert the user ID to an integer
        user_id = int(user_id)

        # Extract the month and year from the current date
        today = datetime.now()
        month = today.month
        year = today.year

        # Create a new Expense object and associate it with the user ID
        expense = Expense(reason=reason, amount=amount, user_id=user_id, month=month, year=year)
        db.session.add(expense)
        db.session.commit()

        return jsonify({'success': True}), 200

    except Exception as e:
        print(e)
        return jsonify({'success': False}), 500


@app.route('/get_today_expenses/<int:user_id>')
def get_today_expenses(user_id):
    try:
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        expenses = Expense.query.filter(Expense.user_id == user_id, Expense.date >= today).order_by(desc(Expense.date)).all()

        # Prepare the data to be sent to the front-end
        expenses_data = [{'id': expense.id, 'reason': expense.reason, 'amount': expense.amount} for expense in expenses]
        expenses_data.reverse()
        return jsonify({'expenses': expenses_data}), 200

    except Exception as e:
        print(e)
        return jsonify({'success': False}), 500


@app.route('/get_last_7_days_expenses/<int:user_id>')
def get_last_7_days_expenses(user_id):
    try:
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        last_7_days = today - timedelta(days=7)
        expenses = Expense.query.filter(Expense.user_id == user_id, Expense.date >= last_7_days, Expense.date < today).all()

        # Create a dictionary to store expenses by date and their total amount
        daily_expenses = {}
        for e in expenses:
            date_str = e.date.strftime('%Y-%m-%d')
            if date_str in daily_expenses:
                daily_expenses[date_str]['totalAmount'] += e.amount
            else:
                daily_expenses[date_str] = {'totalAmount': e.amount, 'details': []}

            daily_expenses[date_str]['details'].append({'reason': e.reason, 'amount': e.amount})

        # Convert the dictionary to a list of expenses sorted by date
        result = [{'date': date, **data} for date, data in daily_expenses.items()]
        sorted_result = sorted(result, key=lambda x: x['date'], reverse=True)
        return jsonify({'expenses': sorted_result}), 200

    except Exception as e:
        print(e)
        return jsonify({'success': False}), 500


@app.route('/get_all_months_expenses/<int:user_id>')
def get_all_months_expenses(user_id):
    try:
        all_months_expenses = {}

        # Get all unique months from the database
        unique_months = db.session.query(func.date_trunc('month', Expense.date)) \
            .filter_by(user_id=user_id) \
            .distinct().all()

        # Define the maximum number of months to keep
        max_months_to_keep = 6

        # Check if the number of unique months is greater than the maximum allowed
        if len(unique_months) > max_months_to_keep:
            # Calculate the date for the oldest month to keep
            oldest_month_date = datetime.now() - relativedelta(months=max_months_to_keep)

            # Delete all expenses from months beyond the maximum allowed
            Expense.query.filter(Expense.date < oldest_month_date).delete()
            db.session.commit()

            # Use VACUUM to reclaim unused space and reduce the database file size
            # db.session.execute(text("VACUUM"))

        # Fetch all remaining expenses from the database
        all_expenses = Expense.query.filter_by(user_id=user_id).all()

        for expense in all_expenses:
            # Extract the year and month from the expense date
            year_month = expense.date.strftime('%Y-%m')

            if year_month not in all_months_expenses:
                all_months_expenses[year_month] = {
                    'totalAmount': expense.amount,
                    'details': [{'date': expense.date.strftime('%Y-%m-%d'), 'reason': expense.reason, 'amount': expense.amount}]
                }
            else:
                all_months_expenses[year_month]['totalAmount'] += expense.amount
                all_months_expenses[year_month]['details'].append({'date': expense.date.strftime('%Y-%m-%d'), 'reason': expense.reason, 'amount': expense.amount})

        # Prepare the data to be sent to the front-end and sort the months in descending order
        expenses_data = []
        show_remove_button = False  # Flag to control showing the "Remove" button
        for year_month, data in sorted(all_months_expenses.items(), reverse=True):
            year, month = map(int, year_month.split('-'))
            month_name = calendar.month_name[month]
            month_data = {
                'month': f"{month_name} {year}",
                'totalAmount': data['totalAmount'],
                'details': data['details'],
                'showRemoveButton': show_remove_button
            }
            expenses_data.append(month_data)

            # Set the flag to False after the first 6 months
            if len(expenses_data) == max_months_to_keep:
                break
        return jsonify({'expenses': expenses_data}), 200

    except Exception as e:
        print(e)
        return jsonify({'success': False}), 500


@app.route('/get_month_expenses/<int:user_id>/<string:month_name>')
def get_month_expenses(user_id, month_name):
    try:
        # Get the corresponding month number from the month name
        month_name = month_name.split("%")[0].split(" ")[0]
        # month_name = datetime.strptime(month_name, "%B").month

        all_months_expenses = {}

        # Get all unique months from the database
        unique_months = db.session.query(func.date_trunc('month', Expense.date)) \
            .filter_by(user_id=user_id) \
            .distinct().all()

        # Define the maximum number of months to keep
        max_months_to_keep = 6

        # Check if the number of unique months is greater than the maximum allowed
        if len(unique_months) > max_months_to_keep:
            # Calculate the date for the oldest month to keep
            oldest_month_date = datetime.now() - relativedelta(months=max_months_to_keep)

            # Delete all expenses from months beyond the maximum allowed
            Expense.query.filter(Expense.date < oldest_month_date).delete()
            db.session.commit()

            # Use VACUUM to reclaim unused space and reduce the database file size
            # db.session.execute(text("VACUUM"))

        # Fetch all remaining expenses from the database
        all_expenses = Expense.query.filter_by(user_id=user_id).all()

        for expense in all_expenses:
            # Extract the year and month from the expense date
            year_month = expense.date.strftime('%Y-%m')

            if year_month not in all_months_expenses:
                all_months_expenses[year_month] = {
                    'totalAmount': expense.amount,
                    'details': [
                        {'date': expense.date.strftime('%Y-%m-%d'), 'reason': expense.reason, 'amount': expense.amount}]
                }
            else:
                all_months_expenses[year_month]['totalAmount'] += expense.amount
                all_months_expenses[year_month]['details'].append(
                    {'date': expense.date.strftime('%Y-%m-%d'), 'reason': expense.reason, 'amount': expense.amount})

        # Prepare the data to be sent to the front-end and sort the months in descending order
        expenses_data = []
        show_remove_button = False
        for year_month, data in sorted(all_months_expenses.items(), reverse=True):
            year, month = map(int, year_month.split('-'))
            current_month_name = calendar.month_name[month]
            if current_month_name == month_name:
                month_data = {
                    'month': f"{current_month_name} {year}",
                    'totalAmount': data['totalAmount'],
                    'details': data['details'],
                    'showRemoveButton': show_remove_button
                }
                expenses_data.append(month_data)
                break
            else:
                pass

        # Now, prepare the expenses data for the selected month
        selected_month_expenses = all_months_expenses.get(f"{year}-{month:02}")
        if selected_month_expenses:
            expenses_data = selected_month_expenses['details']

        return jsonify({'expenses': expenses_data}), 200

    except Exception as e:
        print(e)
        return jsonify({'success': False}), 500


@app.route('/remove_expense/<int:expense_id>/<int:user_id>', methods=['DELETE'])
def remove_expense(expense_id, user_id):
    try:
        expense = Expense.query.filter_by(id=expense_id, user_id=user_id).first()

        # Check if the expense exists and belongs to the current user
        if expense:
            db.session.delete(expense)
            db.session.commit()
            return jsonify({'success': True}), 200
        else:
            return jsonify({'success': False, 'message': 'Expense not found or unauthorized to remove.'}), 403

    except Exception as e:
        print(e)
        return jsonify({'success': False}), 500


if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0')


    # to make clean database
    # with app.app_context():
    #     db.create_all()
