from flask import Blueprint, render_template, redirect


profile_bp = Blueprint("profile", __name__)


@profile_bp.route("/")
def index():
    return "Profile"