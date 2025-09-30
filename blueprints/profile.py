from flask import Blueprint, render_template
from flask_login import login_required, current_user
import os


profile_bp = Blueprint("profile", __name__, url_prefix="/profile", template_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "templates"),
                    static_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "templates", "Css"))


@profile_bp.route("/")
@login_required
def profile():
    return render_template("profile.html", user=current_user)
