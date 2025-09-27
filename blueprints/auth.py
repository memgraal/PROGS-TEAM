from flask import Blueprint, request, redirect, url_for, render_template, flash
from flask_login import login_user, logout_user
from models import User, LoginHistory
from extensions import db

auth_bp = Blueprint("auth", __name__, url_prefix="/auth", template_folder="/templates", static_folder="templates/Css")


@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    if request.method == "POST":
        username = request.form["username"].strip()
        email = request.form["email"].strip().lower()
        password = request.form["password"]
        confirm = request.form["confirm"]

        if not username or not email or not password:
            flash("Заполните все поля")
        elif password != confirm:
            flash("Пароли не совпадают")
        elif User.query.filter(
            (User.username == username) | (User.email == email)
        ).first():
            flash("Пользователь с таким именем или email уже существует")
        else:
            user = User(username=username, email=email)
            user.set_password(password)
            db.session.add(user)
            db.session.commit()
            login_user(user)
            flash("Регистрация успешна")
            return redirect(url_for("profile.profile"))
    return render_template("register.html")


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        login_field = request.form["login"].strip()
        password = request.form["password"]

        user = User.query.filter(
            (User.username == login_field) | (User.email == login_field)
        ).first()
        if user and user.check_password(password):
            login_user(user)
            db.session.add(LoginHistory(user_id=user.id, ip=request.remote_addr))
            db.session.commit()
            flash("Успешный вход")
            return redirect(url_for("profile.profile"))
        else:
            flash("Неверный логин или пароль")
    return render_template("login.html")


@auth_bp.route("/logout")
def logout():
    logout_user()
    flash("Вы вышли из системы")
    return redirect(url_for("main.index"))
