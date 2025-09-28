from flask import Blueprint, render_template
from flask_login import current_user
import os

main_bp = Blueprint("main", __name__, template_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "templates"),
                    static_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "templates", "Css"))


@main_bp.route("/")
def index():
    return render_template("index.html", user=current_user)
