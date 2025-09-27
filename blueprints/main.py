from flask import Blueprint, render_template
from flask_login import current_user

main_bp = Blueprint("main", __name__, template_folder="/templates", static_folder="/templates/Css")


@main_bp.route("/")
def index():
    return render_template("index.html", user=current_user)
