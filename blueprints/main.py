from flask import Blueprint, render_template, redirect, url_for
from flask_login import current_user
import os

main_bp = Blueprint("main", __name__, template_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "templates"),
                    static_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "templates", "Css"))


@main_bp.route("/")
def index():
    if current_user.is_authenticated:
        return render_template("index.html", user=current_user)
    return redirect(url_for("auth.register_login"))