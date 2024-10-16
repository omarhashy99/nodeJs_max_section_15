const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const PORT = process.env.PORT;

const User = require("../models/user");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const sendgridTransport = require("nodemailer-sendgrid-transport");
const crypto = require("crypto");
const transporter = nodemailer.createTransport(
  sendgridTransport({
    auth: {
      api_key: SENDGRID_API_KEY,
    },
  })
);
exports.getLogin = (req, res, next) => {
  let errorMessage = req.flash("error");
  console.log(errorMessage);
  if (errorMessage.length > 0) {
    errorMessage = errorMessage[0];
  } else {
    errorMessage = null;
  }

  res.render("auth/login", {
    path: "/login",
    pageTitle: "Login",
    errorMessage: errorMessage,
  });
};

exports.getSignup = (req, res, next) => {
  let errorMessage = req.flash("error");
  console.log(errorMessage);
  if (errorMessage.length > 0) {
    errorMessage = errorMessage;
  } else {
    errorMessage = null;
  }

  res.render("auth/signup", {
    path: "/signup",
    pageTitle: "Signup",
    errorMessage: errorMessage,
  });
};

exports.postLogin = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  User.findOne({ email: email })
    .then((user) => {
      if (!user) {
        req.flash("error", "Invalid email or password.");
        return res.redirect("/login");
      }
      return bcrypt
        .compare(password, user.password)
        .then((doMatch) => {
          if (doMatch) {
            req.session.bestDevelope = "Omar Hashy";
            req.session.isLoggedIn = true;
            req.session.user = user;
            return req.session.save((err) => {
              if (err) console.error(err);
              res.redirect("/");
            });
          } else {
            req.flash("error", "Invalid email or password.");
          }
          res.redirect("/login");
        })
        .catch((err) => {
          console.error(err);
          res.redirect("/login");
        });
    })
    .catch((err) => console.log(err));
};

exports.postSignup = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  const confirmPassword = req.body.confirmPassword;
  // console.log(User.findOne)
  User.findOne({ email: email })
    .then((userDoc) => {
      if (userDoc) {
        console.log(userDoc);
        req.flash("error", "E-mail exists already.");
        return res.redirect("/signup");
      }
      return bcrypt
        .hash(password, 12)
        .then((hashedPassword) => {
          const user = new User({
            email: email,
            password: hashedPassword,
            cart: { items: [] },
          });
          return user.save();
        })
        .then((result) => {
          transporter.sendMail({
            to: email,
            from: "hashyomar@gmail.com",
            subject: "Signup succeeded!",
            html: "<h1>Signup succeeded!</h1>",
          });
          return res.redirect("/login");
        });
    })
    .catch((err) => console.error(err));
};

exports.postLogout = (req, res, next) => {
  req.session.destroy((err) => {
    console.log(err);
    res.redirect("/");
  });
};

exports.getReset = (req, res, next) => {
  let errorMessage = req.flash("error");
  console.log(errorMessage);
  if (errorMessage.length > 0) {
    errorMessage = errorMessage;
  } else {
    errorMessage = null;
  }

  res.render("auth/reset", {
    path: "/reset",
    pageTitle: "Reset password",
    errorMessage: errorMessage,
  });
};

exports.postReset = (req, res, next) => {
  crypto.randomBytes(32, (err, buffer) => {
    if (err) {
      console.err(err);
      return res.redirect("/reset");
    }
    const token = buffer.toString("hex");
    User.findOne({ email: req.body.email })
      .then((user) => {
        if (!user) {
          req.flash("error", "No account with that email found.");
          return res.redirect("reset");
        }
        user.resetToken = token;
        user.resetTokenExpiration = Date.now() + 30 * 60 * 1000;
        return user.save();
      })
      .then((result) => {
        if (!result) return;
        const link = `http://localhost:${PORT}/new-password/${token}`;
        console.log(link);
        res.redirect("/");
        transporter.sendMail({
          to: req.body.email,
          from: "hashyomar@gmail.com",
          subject: "Password reset!",
          html: `
          <p>You requested a password reset</p>
          <p>Click this  <a href = "${link}"> link </a> to set a new password.</p>
          `,
        });
      })
      .catch((err) => console.error(err));
  });
};

exports.getNewPassword = (req, res, next) => {
  const token = req.params.token;
  User.findOne({
    resetToken: token,
    resetTokenExpiration: { $gt: Date.now() },
  })
    .then((user) => {
      console.log(user);

      let errorMessage = req.flash("error");
      console.log(errorMessage);
      if (errorMessage.length > 0) {
        errorMessage = errorMessage;
      } else {
        errorMessage = null;
      }

      res.render("auth/new-password", {
        path: "/new-password",
        pageTitle: "new password",
        errorMessage: errorMessage,
        userId: user._id.toString(),
        passwordToken: token,
      });
    })
    .catch((err) => console.error(err));
};

exports.postNewPassword = (req, res, next) => {
  const newPassword = req.body.password;
  const userId = req.body.userId;
  const passwordToken = req.body.passwordToken;
  let resetUser;

  User.findOne({
    resetToken: passwordToken,
    resetTokenExpiration: {
      $gt: Date.now(),
    },
    _id: userId,
  })
    .then((user) => {
      resetUser = user;
      return bcrypt.hash(newPassword, 12);
    })
    .then((hashedPassword) => {
      resetUser.password = hashedPassword;
      resetUser.resetToken = undefined;
      resetUser.resetTokenExpiration = undefined;
      return resetUser.save();
    })
    .then((result) => {
      res.redirect("/login");
    })
    .catch((err) => console.error(err));
};
