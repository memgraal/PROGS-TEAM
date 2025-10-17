from flask import Blueprint, request, redirect, url_for, render_template, flash
from flask_login import login_user, logout_user
from models import User, LoginHistory
from extensions import db
import os

auth_bp = Blueprint("auth", __name__, url_prefix="/auth", template_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "templates"),
                    static_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "templates", "Css"))


@auth_bp.route("/", methods=['GET', 'POST'])
def register_login():
    if request.method == "POST":
        pass
    return render_template("diamond-auth.html")


@auth_bp.route("/register", methods=['GET', 'POST'])
def register():
    if request.method == "POST":
        pass
    pass

@auth_bp.route("/login", methods=['GET', 'POST'])
def login():
    if request.method == "POST":
        pass
    pass