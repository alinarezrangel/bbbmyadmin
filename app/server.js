"use strict";

var express = require('express');
var app = express();
var server = require('http').Server(app);
//var io = require('socket.io')(server);
var fs = require('fs');
var bodyParser = require('body-parser');
var mysql = require('mysql');
var bcrypt = require('bcrypt-nodejs');
var S = require("string");
var cookieSession = require("cookie-session");
var crypto = require('crypto');
var request = require('request');
var DOMParser = require('xmldom').DOMParser;
var validator = require('validator');
var ip = require("ip");

var config = JSON.parse(fs.readFileSync(__dirname + "/config.json","utf8"));

function log(txt)
{
	if(config.verbose)
	{
		console.log(txt);
	}
}

function logerr(txt)
{
	if(config.ansicolor)
	{
		console.error("\x1b[31m");
	}
	console.error("Error: " + txt);
	if(config.ansicolor)
	{
		console.error("\x1b[0m");
	}
}

function validName(n)
{
	var i = 0;
	var l = n.length;
	var vc = function(c)
	{
		return S(c).isAlphaNumeric();
	};
	for(i = 0;i < l;i++)
	{
		if(!vc(n.charAt(i)))
			return false;
	}
	return true;
}

function addDates(a, b)
{
	return new Date(a.getFullYear() + b.getFullYear(), a.getMonth() + b.getMonth(), a.getDate() + b.getDate(), a.getHours() + b.getHours(), a.getMinutes() + b.getMinutes(), 0, 0);
}

function nextTime(hours, minutes)
{
	var now = new Date();
	var snow = new Date(0, 0, 0, 0, 0, 0, 0);
	snow.setHours(hours);
	snow.setMinutes(minutes);
	return addDates(now, snow);
}

function handleErrors(err)
{
	if(err)
	{
		logerr(err.toString());
	}
	return err;
}

function datetimeToSQL(date)
{
	// MySQL DATETIME: "YYYY-MM-DD hh:mm:ss"
	var datetime = date.getFullYear();
	var month = (date.getMonth() + 1);
	var day = date.getDate();
	var hours = date.getHours();
	var minutes = date.getMinutes();
	var seconds = date.getSeconds();
	if(month < 10)
	{
		month = "0" + month;
	}
	if(day < 10)
	{
		day = "0" + day;
	}
	if(hours < 10)
	{
		hours = "0" + hours;
	}
	if(minutes < 10)
	{
		minutes = "0" + minutes;
	}
	if(seconds < 10)
	{
		seconds = "0" + seconds;
	}
	datetime += "-" + month;
	datetime += "-" + day;
	datetime += " " + hours;
	datetime += ":" + minutes;
	datetime += ":" + seconds;
	return datetime;
}

function tryParse(str)
{
	var rt = [false, 0];
	try
	{
		rt[1] = parseInt(str);
		rt[0] = true;
	}
	catch(error)
	{
		rt[1] = 0;
	}
	return rt;
}

function parseBBB(api, args)
{
	log("Calling the BBB API: " + api + " with " + JSON.stringify(args));
	log("By default, this not calls anything, and uses its defaults XML");
	log("Step 1: Making the URL params");
	var params = "";
	var oparams = "";
	var attr = "";
	for(attr in args)
	{
		params += encodeURI(attr) + "=" + encodeURI(args[attr]) + "&";
	}
	params = params.slice(0, params.length - 1);
	oparams = params;
	log("Maked " + params);
	log("Step 2: prepend the API call name");
	params = api + params;
	log("Maked " + params);
	log("Step 3: Appending shared secret (only debug if you are sure of that!)");
	params += config.bbb.secret;
	log("Maked " + params);
	log("Step 4: Get the SHA-1 Sum of that and it is the checksum param");
	var shasum = crypto.createHash("sha1");
	shasum.update(params);
	var sum = shasum.digest("hex");
	if(oparams.length > 0)
	{
		oparams += "&";
	}
	oparams += "checksum=" + sum;
	log("Maked " + oparams);
	log("Ready to send query");
	oparams = config.bbb.totalhost + api + "?" + oparams;
	log("Query to " + oparams);
	return oparams;
}

function callBBB(api, args, callback)
{
	log("Calling BBB");
	var oparams = parseBBB(api, args);
	request(oparams, function(error, response, body)
	{
		if(handleErrors(error))
		{
			callback(error, null);
			return;
		}
		log("Status " + JSON.stringify(response));
		// body es el XML devuelto por BBB
		var parser = new DOMParser();
		callback(error, parser.parseFromString(body));
	});
}

function saveConfig()
{
	fs.writeFileSync("config.json", JSON.stringify(config, null, "\t"));
}

function requestAllUserData(connection, res, query, args, each, end)
{
	connection.query(query, args, function(err, rows)
	{
		if(handleErrors(err))
		{
			res.status(500);
			res.sendFile(__dirname + "/servererror.html");
			return;
		}
		if((typeof rows === "undefined") || (typeof rows[0] === "undefined"))
		{
			//handleErrors(new Error("Unexpected query result null"));
			//res.status(500);
			res.sendFile(__dirname + "/adminusers.html");
			connection.end();
			return;
		}
		log("SQL level 1: page limit");
		var json = {users: []};
		for(let i = 0;i < rows.length;i++)
		{
			var rw = rows[i];
			log("SQL level 1.1: row at " + i + " is " + JSON.stringify(rw));
			connection.query("SELECT * FROM `personas` WHERE `id`=" + connection.escape(rw.persona + ""), function(rd, err, pp)
			{
				if(handleErrors(err))
				{
					res.status(500);
					res.sendFile(__dirname + "/servererror.html");
					return;
				}
				if((typeof pp === "undefined") || (typeof pp[0] === "undefined"))
				{
					handleErrors(new Error("Unexpected query result null"));
					res.status(500);
					res.sendFile(__dirname + "/servererror.html");
					connection.end();
					return;
				}
				log("SQL level 2: persona with ID=" + rd.persona + " at " + JSON.stringify(pp));
				connection.query("SELECT * FROM `permisos` WHERE `id`=" + connection.escape(rd.permisos + ""), function(rd, pp, err, ps)
				{
					if(handleErrors(err))
					{
						res.status(500);
						res.sendFile(__dirname + "/servererror.html");
						return;
					}
					if((typeof ps === "undefined") || (typeof ps[0] === "undefined"))
					{
						handleErrors(new Error("Unexpected query result null"));
						res.status(500);
						res.sendFile(__dirname + "/servererror.html");
						connection.end();
						return;
					}
					log("SQL level 3: permiso with ID=" + rd.permisos + " at " + JSON.stringify(ps));
					connection.query("SELECT * FROM `salas` WHERE `id`=" + connection.escape(rd.sala + ""), function(rd, pp, ps, err, sl)
					{
						if(handleErrors(err))
						{
							res.status(500);
							res.sendFile(__dirname + "/servererror.html");
							return;
						}
						if((typeof sl === "undefined") || (typeof sl[0] === "undefined"))
						{
							handleErrors(new Error("Unexpected query result null"));
							res.status(500);
							res.sendFile(__dirname + "/servererror.html");
							connection.end();
							return;
						}
						log("SQL level 4: salas with ID=" + rd.sala);
						var user = each(err, rd, pp, ps, sl);
						json.users.push(user);
						if(json.users.length == rows.length)
						{
							log("SQL successful");
							end(err, json);
						}
					}.bind(connection, rd, pp, ps));
				}.bind(connection, rd, pp));
			}.bind(connection, rw));
		}
	});
}

function getStdUserData(rd, pp, ps, sl)
{
	var user = {};
	user.username = rd.apodo;
	user.email = rd.email;
	user.lastaccess = S(rd.ultimo_acceso).replaceAll("T", " ").replaceAll("Z", "").s;
	user.nextroom = sl[0].nombre;
	user.nextroomid = sl[0].bbbid;
	user.name = pp[0].nombre;
	user.lastname = pp[0].apellidos;
	user.ci = pp[0].cedula;
	user.role = "+";
	if(ps[0].ingresar == "1")
		user.role += "i";
	if(ps[0].crear == "1")
		user.role += "n";
	if(ps[0].cerrar == "1")
		user.role += "c";
	if(ps[0].listar == "1")
		user.role += "l";
	if(ps[0].configurar == "1")
		user.role += "a";
	user.role += "-";
	if(ps[0].ingresar == "0")
		user.role += "i";
	if(ps[0].crear == "0")
		user.role += "n";
	if(ps[0].cerrar == "0")
		user.role += "c";
	if(ps[0].listar == "0")
		user.role += "l";
	if(ps[0].configurar == "0")
		user.role += "a";
	user.rolev = "Personalizado";
	if(user.role == "+incla-")
	{
		user.rolev = "Administrador";
	}
	if(user.role == "+i-ncla")
	{
		user.rolev = "Usuario";
	}
	if(user.role == "+incl-a")
	{
		user.rolev = "Moderador";
	}
	return user;
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
//app.use(express.cookieParser());
// Un dia tiene 24 horas
// Una hora tiene 60 minutos
// Un minuto tiene 60 segundos
// Un segunto tiene 1000 milisegundos
// MaxAge es en milisegundos, por ende, un dia = 24 * 60 * 60 * 1000 = 86400000
app.use(cookieSession({secret: config.sessions.secret, httpOnly: true, maxAge: 86400000}));

app.use(express.static('public'));

server.listen(config.server.port);

app.get('/', function(req, res)
{
	if((req.session !== null) && (req.session.valid === "true"))
	{
		res.redirect("/user");
	}
	else
	{
		res.sendFile(__dirname + '/index.html');
	}
});

app.get("/login", function(req, res)
{
	//res.status(403);
	//res.sendFile(__dirname + "/index.html");
	res.redirect("/?startAtScreen=login");
});

app.get('/user', function(req, res)
{
	/*var file = "/index.html";
	var st = 200;*/
	if((req.session !== null) && (req.session.valid === "true"))
	{
		res.sendFile(__dirname + "/admin.html");
	}
	else
	{
		res.redirect("/?startAtScreen=login");
	}
});

app.get("/config", function(req, res)
{
	// Configuracion para navegadores sin javascript
	if((req.session !== null) && (req.session.valid === "true"))
	{
		var connection = mysql.createConnection(
		{
			host     : config.database.host,
			user     : config.database.user,
			password : config.database.password,
			database: config.database.name
		});
		var p = "";
		connection.query("SELECT * FROM `permisos` WHERE `id`=" + connection.escape(req.session.eid + ""), function(err, rows)
		{
			if(handleErrors(err))
			{
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				return;
			}
			if((typeof rows === "undefined") || (typeof rows[0] === "undefined"))
			{
				handleErrors(new Error("Unexpected query result null"));
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				connection.end();
				return;
			}
			log("Matched " + JSON.stringify(rows));
			p = rows[0].crear + "" + rows[0].cerrar + "" + rows[0].ingresar + "" + rows[0].listar + "" + rows[0].configurar;
			if(p.charAt(4) == "1")
			{
				// Tiene permisos
				log("El usuario puede acceder a la configuración");
				res.send(fs.readFileSync(__dirname + "/header.frame.html", "utf8") +
					fs.readFileSync(__dirname + "/adminconfig.frame.html", "utf8") +
					fs.readFileSync(__dirname + "/footer.frame.html", "utf8"));
			}
			else
			{
				res.status(403);
				res.sendFile(__dirname + "/forbidden.html");
			}
			connection.end();
		});
	}
	else
	{
		res.redirect("/");
	}
});

app.get("/manageusers", function(req, res)
{
	// Configuracion para navegadores sin javascript
	if((req.session !== null) && (req.session.valid === "true"))
	{
		var connection = mysql.createConnection(
		{
			host     : config.database.host,
			user     : config.database.user,
			password : config.database.password,
			database: config.database.name
		});
		var p = "";
		connection.query("SELECT * FROM `permisos` WHERE `id`=" + connection.escape(req.session.eid + ""), function(err, rows)
		{
			if(handleErrors(err))
			{
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				return;
			}
			if((typeof rows === "undefined") || (typeof rows[0] === "undefined"))
			{
				handleErrors(new Error("Unexpected query result null"));
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				connection.end();
				return;
			}
			log("Matched " + JSON.stringify(rows));
			p = rows[0].crear + "" + rows[0].cerrar + "" + rows[0].ingresar + "" + rows[0].listar + "" + rows[0].configurar;
			if(p.charAt(4) == "1")
			{
				// Tiene permisos
				log("El usuario puede acceder al UserManagerSystem");
				var r = req.query.get;
				if(typeof r === "undefined")
				{
					res.send(fs.readFileSync(__dirname + "/adminusers.html", "utf8"));
					connection.end();
				}
				else if(r == "user")
				{
					var uname = req.query.username;
					if(typeof uname === "undefined")
					{
						handleErrors(new Error(""));
						connection.end();
						return;
					}
					if(p.charAt(4) != "1")
					{
						res.send(__dirname + "/forbidden.html");
						connection.end();
						return;
					}
					requestAllUserData(connection, res, "SELECT * FROM `usuarios` WHERE `apodo` = ?", [uname], function(err, rd, pp, ps, sl)
					{
						if(handleErrors(err))
						{
							res.status(500);
							res.sendFile(__dirname + "/servererror.html");
							return;
						}
						return getStdUserData(rd, pp, ps, sl);
					}, function(err, json)
					{
						if(handleErrors(err))
						{
							res.status(500);
							res.sendFile(__dirname + "/servererror.html");
							return;
						}
						var html = "";
						for(var i = 0;i < json.users.length;i++)
						{
							var j = json.users[i];
							html += "<tr><td>";
							html += j.name;
							html += "</td><td>";
							html += j.lastname;
							html += "</td><td>";
							html += j.ci;
							html += "</td><td>";
							html += j.rolev + " (" + j.role + ")";
							html += "</td><td>";
							html += j.lastaccess;
							html += "</td><td><a href=\"/manageusers?get=user&username=" + encodeURI(j.username) + "\">";
							html += j.username;
							html += "</a></td><td>";
							html += j.nextroom + "@" + j.nextroomid;
							html += "</td></tr>";
						}
						res.send(fs.readFileSync(__dirname + "/header.frame.html") +
							"<table id=\"users\" class=\"table width-block\"><thead><tr class=\"color-greenapple\"><th>Nombre</th><th>Apellidos</th><th>Cedula</th><th>Permisos</th><th>Ultimo acceso</th><th>Nombre de usuario</th><th>Sala de su proxima clase</th></tr></thead><tbody id=\"userstd\">" +
							html +
							"</tbody></table>" +
							S(fs.readFileSync(__dirname + "/usermanage.frame.html")).replaceAll("%USERNAME%", json.users[0].username).s +
							fs.readFileSync(__dirname + "/footer.frame.html"));
						connection.end();
					});
				}
				else if(r == "ulist")
				{
					log("Solicitando usuarios (todos)");
					if(p.charAt(4) == "1")
					{
						var valid = false;
						var pagenth = tryParse(req.query.page);
						valid = pagenth[0];
						pagenth = pagenth[1];
						log("Validando");
						if(!valid)
						{
							log("Invalido, cerrando por " + req.query.page);
							connection.end();
							res.status(500);
							res.sendFile(__dirname + "/servererror.html");
							return;
						}
						log("Valido");
						requestAllUserData(connection, res, "SELECT * FROM `usuarios` LIMIT ?, 20", [pagenth + 0], function(err, rd, pp, ps, sl)
						{
							if(handleErrors(err))
							{
								res.status(500);
								res.sendFile(__dirname + "/servererror.html");
								return;
							}
							return getStdUserData(rd, pp, ps, sl);
						}, function(err, json)
						{
							if(handleErrors(err))
							{
								res.status(500);
								res.sendFile(__dirname + "/servererror.html");
								return;
							}
							var html = "";
							for(var i = 0;i < json.users.length;i++)
							{
								var j = json.users[i];
								html += "<tr><td>";
								html += j.name;
								html += "</td><td>";
								html += j.lastname;
								html += "</td><td>";
								html += j.ci;
								html += "</td><td>";
								html += j.rolev + " (" + j.role + ")";
								html += "</td><td>";
								html += j.lastaccess;
								html += "</td><td><a href=\"/manageusers?get=user&username=" + encodeURI(j.username) + "\">";
								html += j.username;
								html += "</a></td><td>";
								html += j.nextroom + "@" + j.nextroomid;
								html += "</td></tr>";
							}
							res.send(fs.readFileSync(__dirname + "/header.frame.html") +
								"<table id=\"users\" class=\"table width-block\"><thead><tr class=\"color-greenapple\"><th>Nombre</th><th>Apellidos</th><th>Cedula</th><th>Permisos</th><th>Ultimo acceso</th><th>Nombre de usuario</th><th>Sala de su proxima clase</th></tr></thead><tbody id=\"userstd\">" +
								html +
								"</tbody></table><div class=\"navigation color-grey margin-8\"><a href=\"/manageusers?get=ulist&page=" +
								(pagenth - 1) + "\" id=\"ant\">Página anterior</a> <a href=\"#\" id=\"cur\">" +
								pagenth + "</a> <a href=\"/manageusers?get=ulist&page=" + (pagenth + 1) +
								"\" id=\"sig\">Página siguiente</a></div>" +
								fs.readFileSync(__dirname + "/footer.frame.html"));
							connection.end();
						});
					}
					else
					{
						res.send(__dirname + "/forbidden.html");
					}
				}
			}
			else
			{
				res.status(403);
				res.sendFile(__dirname + "/forbidden.html");
				connection.end();
			}
		});
	}
	else
	{
		res.redirect("/");
	}
});

app.post("/manageusers", function(req, res)
{
	// Configuracion para navegadores sin javascript
	if((req.session !== null) && (req.session.valid === "true"))
	{
		var connection = mysql.createConnection(
		{
			host     : config.database.host,
			user     : config.database.user,
			password : config.database.password,
			database: config.database.name
		});
		var p = "";
		connection.query("SELECT * FROM `permisos` WHERE `id`=" + connection.escape(req.session.eid + ""), function(err, rows)
		{
			if(handleErrors(err))
			{
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				return;
			}
			if((typeof rows === "undefined") || (typeof rows[0] === "undefined"))
			{
				handleErrors(new Error("Unexpected query result null"));
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				connection.end();
				return;
			}
			log("Matched " + JSON.stringify(rows));
			p = rows[0].crear + "" + rows[0].cerrar + "" + rows[0].ingresar + "" + rows[0].listar + "" + rows[0].configurar;
			if(p.charAt(4) == "1")
			{
				// Tiene permisos
				log("El usuario puede acceder al UserManagerSystem");
				/*res.send(fs.readFileSync(__dirname + "/adminusers.html", "utf8"));*/
				var action = req.body.action;
				if(action == "newuser")
				{
					var name = req.body.name;
					var lastname = req.body.lastname;
					var ci = req.body.ci;
					var nickname = req.body.nickname;
					var password = req.body.password;
					var email = req.body.email;
					var role = req.body.role;
					var error = null;
					var ecode = 0;
					// Validate inputs
					// Names and lastnames aren't checked, but their are escaped.
					// The CI is: /[vV]?[0-9]+/, it not contains any letter except the first character
					// I can add more restrictions, but others contries can add their own rules and I
					// need this more international.
					// If the CI is null, undefined or "" then is NULL.
					if((!S(ci).isNumeric()) && (ci != ""))
					{
						// Invalid CI
						error = new Error("Invalid C.I. : Expected a numeric input only");
						ecode |= 1;
					}
					if(S(ci).isNumeric())
					{
						ci = parseInt(ci);
					}
					if(ci === "")
					{
						ci = null;
					}
					// The nickname is only alphanumeric
					if(!S(nickname).isAlphaNumeric())
					{
						error = new Error("Invalid nickname: Expected a alphanumeric only input");
						ecode |= 2;
					}
					// The password is escaped, but no validated
					// The role can be user, mod or admin
					switch(role)
					{
						case "user":
						case "mod":
						case "admin":
							break;
						default:
							error = new Error("Invalid userrole: Expected a user, moderator ar administrator");
							ecode |= 4;
					}
					// The email is validated using the validator module
					if(!validator.isEmail(email))
					{
						error = new Error("Invalid email: " + email);
						ecode |= 8;
					}
					if(handleErrors(error))
					{
						res.send(__dirname + "/adminusers.html?errorCode=" + ecode);
						connection.end();
						return;
					}
					connection.query("INSERT INTO `personas` (`id`, `nombre`, `apellidos`, `cedula`) VALUES (NULL, ?, ?, ?)", [name, lastname, ci], function(err, rows)
					{
						if(handleErrors(err))
						{
							res.status(500);
							res.sendFile(__dirname + "/servererror.html");
							return;
						}
						var pid = 0;
						switch(role)
						{
							case "user":
								pid = 0;
								break;
							case "mod":
								pid = 2;
								break;
							case "admin":
								pid = 1;
								break;
						}
						connection.query("INSERT INTO `usuarios` (`id`, `apodo`, `contrasenna`, `persona`, `permisos`, `email`, `ultimo_acceso`, `sala`) VALUES (NULL, ?, ?, ?, ?, ?, '2016-01-01 00:00:00', 0)",
							[nickname, bcrypt.hashSync(password, bcrypt.genSaltSync()), rows.insertId, pid, email], function(err, rows)
						{
							if(handleErrors(err))
							{
								res.status(500);
								res.sendFile(__dirname + "/servererror.html");
								return;
							}
							log("Created user");
							connection.end();
							res.sendFile(__dirname + "/adminusers.html");
						});
					});
				}
				if(action == "finduser")
				{
					var sql = "SELECT * FROM `usuarios` WHERE 1 LIMIT 1";
					var findby = req.body.findby + "";
					var search = req.body.search + "";
					var pagenth = req.query.page;
					if((typeof findby === "undefined") || (typeof search === "undefined"))
					{
						handleErrors(new Error("The search is invalid because a needed search field is undefined or null"));
						connection.end();
						return;
					}
					var valid = false;
					var pagenth = tryParse(req.query.page);
					valid = pagenth[0];
					pagenth = pagenth[1];
					log("Validando");
					if(!valid)
					{
						pagenth = 0;
						valid = true;
					}
					switch(findby)
					{
						case "username":
							sql = "SELECT * FROM `usuarios` WHERE `apodo` LIKE ?";
							search = "%" + search + "%";
							break;
						case "ci":
							sql = "SELECT * FROM `usuarios` WHERE `persona` = (SELECT `id` FROM `personas` WHERE `cedula` = ?)";
							break;
						case "names":
							sql = "SELECT * FROM `usuarios` WHERE `persona` IN (SELECT `id` FROM `personas` WHERE CONCAT(CONCAT(`nombre`, \" \"), `apellidos`) LIKE ?)";
							search = "%" + search + "%";
							break;
						case "room":
							sql = "SELECT * FROM `usuarios` WHERE `sala` IN (SELECT `id` FROM `salas` WHERE `bbbid` LIKE ?)";
							search = "%" + search + "%";
							break;
					}
					log("Matched " + sql + " with " + search);
					requestAllUserData(connection, res, sql, [search], function(err, rd, pp, ps, sl)
					{
						if(handleErrors(err))
						{
							res.status(500);
							res.sendFile(__dirname + "/servererror.html");
							return;
						}
						return getStdUserData(rd, pp, ps, sl);
					}, function(err, json)
					{
						if(handleErrors(err))
						{
							res.status(500);
							res.sendFile(__dirname + "/servererror.html");
							return;
						}
						var html = "";
						for(var i = 0;i < json.users.length;i++)
						{
							var j = json.users[i];
							html += "<tr><td>";
							html += j.name;
							html += "</td><td>";
							html += j.lastname;
							html += "</td><td>";
							html += j.ci;
							html += "</td><td>";
							html += j.rolev + " (" + j.role + ")";
							html += "</td><td>";
							html += j.lastaccess;
							html += "</td><td><a href=\"/manageusers?get=user&username=" + encodeURI(j.username) + "\">";
							html += j.username;
							html += "</a></td><td>";
							html += j.nextroom + "@" + j.nextroomid;
							html += "</td></tr>";
						}
						res.send(fs.readFileSync(__dirname + "/header.frame.html") +
							"<table id=\"users\" class=\"table width-block\"><thead><tr class=\"color-greenapple\"><th>Nombre</th><th>Apellidos</th><th>Cedula</th><th>Permisos</th><th>Ultimo acceso</th><th>Nombre de usuario</th><th>Sala de su proxima clase</th></tr></thead><tbody id=\"userstd\">" +
							html +
							"</tbody></table><div class=\"navigation color-grey margin-8\"><a href=\"/manageusers?get=ulist&page=" +
							(pagenth - 1) + "\" id=\"ant\">Página anterior</a> <a href=\"#\" id=\"cur\">" +
							pagenth + "</a> <a href=\"/manageusers?get=ulist&page=" + (pagenth + 1) +
							"\" id=\"sig\">Página siguiente</a></div>" +
							fs.readFileSync(__dirname + "/footer.frame.html"));
						connection.end();
					});
				}
				if(action == "handle")
				{
					var name = req.body.name;
					var lastname = req.body.lastname;
					var ci = req.body.ci;
					var nickname = req.body.nickname;
					var password = req.body.password;
					var email = req.body.email;
					var user = req.body.username;
					var cancelable = req.body.cancel;
					var need_user = false;
					var need_person = false;
					var valid = function(f)
					{
						return (typeof f !== "undefined") && (f.toString() != "");
					};
					var updateUser = function(id, callback)
					{
						var sqlquery = "UPDATE `usuarios` SET ";
						if(valid(nickname))
						{
							sqlquery += "`apodo` = " + connection.escape(nickname) + ", ";
						}
						if(valid(password))
						{
							sqlquery += "`contrasenna` = " + connection.escape(bcrypt.hashSync(password, bcrypt.genSaltSync())) + ", ";
						}
						if(valid(email))
						{
							sqlquery += "`email` = " + connection.escape(email) + ", ";
						}
						if(valid(cancelable))
						{
							var r = (cancelable == "yes")? "0" : "1";
							sqlquery += "`activo` = " + connection.escape(r) + ", ";
						}
						log("The SQL is " + sqlquery);
						if(sqlquery == "UPDATE `usuarios` SET ")
						{
							log("Calling callback");
							callback();
							return;
						}
						else
						{
							sqlquery = sqlquery.slice(0, sqlquery.length - 2);
							sqlquery += " WHERE `id` = " + connection.escape(id);
						}
						log("Executed " + sqlquery);
						connection.query(sqlquery, function(err, rows)
						{
							if(handleErrors(err))
							{
								res.status(500);
								res.sendFile(__dirname + "/servererror.html");
								return;
							}
							callback();
						});
					};
					var updatePeople = function(id, callback)
					{
						var sqlquery = "UPDATE `personas` SET ";
						if(valid(name))
						{
							sqlquery += "`nombre` = " + connection.escape(name) + ", ";
						}
						if(valid(lastname))
						{
							sqlquery += "`apellidos` = " + connection.escape(lastname) + ", ";
						}
						if(valid(ci))
						{
							sqlquery += "`cedula` = " + connection.escape(ci) + ", ";
						}
						log("The SQL is " + sqlquery);
						if(sqlquery == "UPDATE `personas` SET ")
						{
							log("Calling callback");
							callback();
							return;
						}
						else
						{
							sqlquery = sqlquery.slice(0, sqlquery.length - 2);
							sqlquery += "WHERE `id` = " + connection.escape(id);
						}
						log("Executed " + sqlquery);
						connection.query(sqlquery, function(err, rows)
						{
							if(handleErrors(err))
							{
								res.status(500);
								res.sendFile(__dirname + "/servererror.html");
								return;
							}
							callback();
						});
					};
					if(!valid(user))
					{
						res.redirect("/manageusers?get=user&username=")
					}
					if(valid(name) || valid(lastname) || valid(ci))
					{
						need_person = true;
					}
					if(valid(nickname) || valid(password) || valid(email))
					{
						need_user = true;
					}
					connection.query("SELECT * FROM `usuarios` WHERE `apodo` = ?", [user + ""], function(err, urs)
					{
						if(handleErrors(err))
						{
							res.status(500);
							res.sendFile(__dirname + "/servererror.html");
							return;
						}
						if((typeof urs === "undefined") || (typeof urs[0] === "undefined"))
						{
							handleErrors(new Error("Unexpected query result null"));
							res.status(500);
							res.sendFile(__dirname + "/servererror.html");
							connection.end();
							return;
						}
						updateUser(urs[0].id, function(pid)
						{
							updatePeople(pid, function()
							{
								res.redirect("/manageusers");
								connection.end();
							});
						}.bind(connection, urs[0].persona));
					});
				}
				if(action == "delete")
				{
					var nickname = req.body.nickname;
					log("Deleting user " + nickname);
					connection.query("SELECT * FROM `usuarios` WHERE `apodo` = ?", [nickname], function(err, rows)
					{
						if(handleErrors(err))
						{
							res.status(500);
							res.sendFile(__dirname + "/servererror.html");
							return;
						}
						if((typeof rows === "undefined") || (typeof rows[0] === "undefined"))
						{
							handleErrors(new Error("Unexpected query result null"));
							res.redirect("/manageusers?errorCode=5");
							connection.end();
							return;
						}
						var pid = rows[0].persona;
						var uid = rows[0].id;
						connection.query("DELETE FROM `usuarios` WHERE `id` = ?", [uid], function(pid, err, urs)
						{
							if(handleErrors(err))
							{
								res.status(500);
								res.sendFile(__dirname + "/servererror.html");
								return;
							}
							connection.query("DELETE FROM `personas` WHERE `id` = ?", [pid], function(err, jrs)
							{
								if(handleErrors(err))
								{
									res.status(500);
									res.sendFile(__dirname + "/servererror.html");
									return;
								}
								connection.end();
								res.redirect("/manageusers");
							});
						}.bind(connection, pid));
					});
				}
			}
			else
			{
				res.status(403);
				res.sendFile(__dirname + "/forbidden.html");
				connection.end();
			}
		});
	}
	else
	{
		res.redirect("/");
	}
});

app.get("/rooms", function(req, res)
{
	// Configuracion para navegadores sin javascript
	if((req.session !== null) && (req.session.valid === "true"))
	{
		var connection = mysql.createConnection(
		{
			host     : config.database.host,
			user     : config.database.user,
			password : config.database.password,
			database: config.database.name
		});
		var p = "";
		connection.query("SELECT * FROM `permisos` WHERE `id`=" + connection.escape(req.session.eid + ""), function(err, rows)
		{
			if(handleErrors(err))
			{
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				return;
			}
			if((typeof rows === "undefined") || (typeof rows[0] === "undefined"))
			{
				handleErrors(new Error("Unexpected query result null"));
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				connection.end();
				return;
			}
			log("Matched " + JSON.stringify(rows));
			p = rows[0].crear + "" + rows[0].cerrar + "" + rows[0].ingresar + "" + rows[0].listar + "" + rows[0].configurar;
			if(p.charAt(3) == "1")
			{
				// Tiene permisos
				var rooms = "<ul class=\"list\">";
				log("Requesting BBB API (/rooms): " + config.bbb.totalhost);
				callBBB("getMeetings", {}, function(err, xml)
				{
					if(handleErrors(err))
					{
						res.status(500);
						res.send("");
						return;
					}
					var meetings = xml.getElementsByTagName("meeting");
					var i = 0;
					var l = meetings.length;
					for(i = 0;i < l;i++)
					{
						var mt = meetings[i];
						var meeting = {
							id: "",
							name: "",
							running: false,
							pcount: 0,
							lcount: 0,
							logged: false
						};
						meeting.id = mt.getElementsByTagName("meetingID")[0].textContent;
						meeting.name = mt.getElementsByTagName("meetingName")[0].textContent;
						meeting.running = mt.getElementsByTagName("running")[0].textContent == "true";
						meeting.pcount = parseInt(mt.getElementsByTagName("participantCount")[0].textContent);
						meeting.lcount = parseInt(mt.getElementsByTagName("listenerCount")[0].textContent);
						meeting.logged = mt.getElementsByTagName("hasUserJoined")[0].textContent == "true";
						rooms += "<li>";
						rooms += meeting.name + "@" + meeting.id;
						if(!meeting.running)
						{
							rooms += " <span class=\"text-color-red\">La sala no esta corriendo, le recomendamos borrarla</span>"
						}
							li += " <a href=\"/joinRoom?id=" + meeting.id + "\">Ingresar</a></li>";
					}
					rooms += "</ul>";
					res.send(fs.readFileSync(__dirname + "/header.frame.html", "utf8") +
						rooms +
						fs.readFileSync(__dirname + "/footer.frame.html", "utf8"));
				});
			}
			else
			{
				res.status(403);
				res.sendFile(__dirname + "/forbidden.html");
			}
			connection.end();
		});
	}
	else
	{
		res.redirect("/");
	}
});

app.get("/deleteuser", function(req, res)
{
	// Configuracion para navegadores sin javascript
	if((req.session !== null) && (req.session.valid === "true"))
	{
		var connection = mysql.createConnection(
		{
			host     : config.database.host,
			user     : config.database.user,
			password : config.database.password,
			database: config.database.name
		});
		var p = "";
		connection.query("SELECT * FROM `permisos` WHERE `id`=" + connection.escape(req.session.eid + ""), function(err, rows)
		{
			if(handleErrors(err))
			{
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				return;
			}
			if((typeof rows === "undefined") || (typeof rows[0] === "undefined"))
			{
				handleErrors(new Error("Unexpected query result null"));
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				connection.end();
				return;
			}
			log("Matched " + JSON.stringify(rows));
			p = rows[0].crear + "" + rows[0].cerrar + "" + rows[0].ingresar + "" + rows[0].listar + "" + rows[0].configurar;
			if(p.charAt(4) == "1")
			{
				// Tiene permisos
				res.send(fs.readFileSync(__dirname + "/header.frame.html", "utf8") +
					fs.readFileSync(__dirname + "/deleteuser.frame.html", "utf8") +
					fs.readFileSync(__dirname + "/footer.frame.html", "utf8"));
			}
			else
			{
				res.status(403);
				res.sendFile(__dirname + "/forbidden.html");
			}
			connection.end();
		});
	}
	else
	{
		res.redirect("/");
	}
});

app.post("/config", function(req, res)
{
	if((req.session !== null) && (req.session.valid === "true"))
	{
		var post = req.body;
		var connection = mysql.createConnection(
		{
			host     : config.database.host,
			user     : config.database.user,
			password : config.database.password,
			database: config.database.name
		});
		var p = "";
		connection.query("SELECT * FROM `permisos` WHERE `id`=" + connection.escape(req.session.eid + ""), function(err, rows)
		{
			if(handleErrors(err))
			{
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				return;
			}
			if((typeof rows === "undefined") || (typeof rows[0] === "undefined"))
			{
				handleErrors(new Error("Unexpected query result null"));
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				connection.end();
				return;
			}
			log("Matched " + JSON.stringify(rows));
			p = rows[0].crear + "" + rows[0].cerrar + "" + rows[0].ingresar + "" + rows[0].listar + "" + rows[0].configurar;
			if(p.charAt(4) == "1")
			{
				// Tiene permisos
				log("El usuario puede acceder a la configuración");
				if(typeof post.port != "undefined")
				{
					log("Intento de cambiar el puerto a " + post.port);
					config.server.port = parseInt(post.port);
				}
				if(typeof post.sessionsecret != "undefined")
				{
					log("Intento de cambiar el secreto de sesion a " + post.sessionsecret);
					config.session.secret = post.sessionsecret;
				}
				if(typeof post.dbname != "undefined")
				{
					log("Intento de cambiar la base de datos a " + post.dbname);
					config.database.name = post.dbname;
				}
				if(typeof post.dbuser != "undefined")
				{
					log("Intento de cambiar el usuario de la db a " + post.dbuser);
					config.database.user = post.dbuser;
				}
				if(typeof post.dbpassword != "undefined")
				{
					log("Intento de cambiar la contraseña de la db a " + post.dbpassword);
					config.database.password = post.dbpassword;
				}
				if(typeof post.dbhost != "undefined")
				{
					log("Intento de cambiar el host de la db a " + post.dbhost);
					config.database.host = post.dbhost;
				}
				if(typeof post.bbbsecret != "undefined")
				{
					log("Intento de cambiar el secreto de BigBlueButton a " + post.bbbsecret);
					config.bbb.secret = post.bbbsecret;
				}
				if(typeof post.bbbhost != "undefined")
				{
					log("Intento de cambiar el host de BigBlueButton a " + post.bbbhost);
					config.bbb.totalhost = post.bbbhost;
				}
				log("La configuración queda como: " + JSON.stringify(config, null, 4));
				log("Guardando...");
				saveConfig();
				res.redirect("/user?startAtScreen=config");
			}
			connection.end();
		});
	}
	else
	{
		res.status(403);
		res.sendFile(__dirname + "/forbidden.html");
	}
})

app.get("/data", function(req, res)
{
	var request = req.query.request;
	if((typeof request !== "undefined") && (req.session !== null) && (req.session.valid === "true"))
	{
		// Es una consulta AJAX GET
		// request = "permissions" | "name" | ""
		var connection = mysql.createConnection(
		{
			host     : config.database.host,
			user     : config.database.user,
			password : config.database.password,
			database: config.database.name
		});
		var p = "";
		connection.query("SELECT * FROM `permisos` WHERE `id`=" + connection.escape(req.session.eid + ""), function(err, rows)
		{
			if(handleErrors(err))
			{
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				return;
			}
			if((typeof rows === "undefined") || (typeof rows[0] === "undefined"))
			{
				handleErrors(new Error("Unexpected query result null"));
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				connection.end();
				return;
			}
			var close = true;
			log("Matched " + JSON.stringify(rows));
			p = rows[0].crear + "" + rows[0].cerrar + "" + rows[0].ingresar + "" + rows[0].listar + "" + rows[0].configurar;
			if(request == "username")
			{
				res.send(req.session.username);
			}
			if(request == "name")
			{
				var name = "";
				log("SELECT * FROM `personas` WHERE `id`=" + req.session.pid);
				close = false;
				connection.query("SELECT * FROM `personas` WHERE `id`=" + connection.escape(req.session.pid + ""), function(err, rows)
				{
					if(handleErrors(err))
					{
						res.status(500);
						res.sendFile(__dirname + "/servererror.html");
						return;
					}
					if((typeof rows === "undefined") || (typeof rows[0] === "undefined"))
					{
						handleErrors(new Error("Unexpected query result null"));
						res.status(500);
						res.sendFile(__dirname + "/servererror.html");
						connection.end();
						return;
					}
					log("Matched " + JSON.stringify(rows));
					name = rows[0].nombre;
					res.send(name);
					connection.end();
				});
			}
			if(request == "tname")
			{
				var name = "";
				log("SELECT * FROM `personas` WHERE `id`=" + req.session.pid);
				close = false;
				connection.query("SELECT * FROM `personas` WHERE `id`=" + connection.escape(req.session.pid + ""), function(err, rows)
				{
					if(handleErrors(err))
					{
						res.status(500);
						res.sendFile(__dirname + "/servererror.html");
						return;
					}
					if((typeof rows === "undefined") || (typeof rows[0] === "undefined"))
					{
						handleErrors(new Error("Unexpected query result null"));
						res.status(500);
						res.sendFile(__dirname + "/servererror.html");
						connection.end();
						return;
					}
					log("Matched " + JSON.stringify(rows));
					name = rows[0].nombre + " " + rows[0].apellidos;
					res.send(name);
					connection.end();
				});
			}
			if(request == "permissions")
			{
				log("Permisos del usuario: " + p);
				res.send(p);
			}
			if(request == "adminconfigframe")
			{
				log("Solicitando frame de configuracion: ");
				if(p.charAt(4) == "1")
				{
					log("Otorgando: posee los permisos");
					res.sendFile(__dirname + "/adminconfig.frame.html");
				}
				else
				{
					res.send("403");
				}
			}
			if(request == "allusers")
			{
				log("Solicitando usuarios (todos)");
				if(p.charAt(4) == "1")
				{
					close = false;
					var valid = false;
					var pagenth = tryParse(req.query.page);
					valid = pagenth[0];
					pagenth = pagenth[1];
					log("Validando");
					if(!valid)
					{
						log("Invalido, cerrando por " + req.query.page);
						connection.end();
						res.send("500");
						return;
					}
					log("Valido");
					requestAllUserData(connection, res, "SELECT * FROM `usuarios` LIMIT ?, 20", [pagenth + 0], function(err, rd, pp, ps, sl)
					{
						if(handleErrors(err))
						{
							res.status(500);
							res.sendFile(__dirname + "/servererror.html");
							return;
						}
						return getStdUserData(rd, pp, ps, sl);
					}, function(err, json)
					{
						if(handleErrors(err))
						{
							res.status(500);
							res.sendFile(__dirname + "/servererror.html");
							return;
						}
						log("Sending " + JSON.stringify(json));
						res.send(JSON.stringify(json));
						connection.end();
					});
				}
				else
				{
					res.send("403");
				}
			}
			if(request == "getrooms")
			{
				log("Solicitando salas");
				if(p.charAt(3) == "1")
				{
					// Tiene permisos de listar todas las salas abiertas
					// HTTP Request to BigBlueButton API
					var json = {meetings: []};
					log("Requesting BBB API: " + config.bbb.totalhost);
					close = false;
					callBBB("getMeetings", {}, function(err, xml)
					{
						if(handleErrors(err))
						{
							res.status(500);
							res.send("");
							return;
						}
						var meetings = xml.getElementsByTagName("meeting");
						var i = 0;
						var l = meetings.length;
						for(i = 0;i < l;i++)
						{
							var mt = meetings[i];
							var meeting = {
								id: "",
								name: "",
								running: false,
								pcount: 0,
								lcount: 0,
								logged: false
							};
							meeting.id = mt.getElementsByTagName("meetingID")[0].textContent;
							meeting.name = mt.getElementsByTagName("meetingName")[0].textContent;
							meeting.running = mt.getElementsByTagName("running")[0].textContent == "true";
							meeting.pcount = parseInt(mt.getElementsByTagName("participantCount")[0].textContent);
							meeting.lcount = parseInt(mt.getElementsByTagName("listenerCount")[0].textContent);
							meeting.logged = mt.getElementsByTagName("hasUserJoined")[0].textContent == "true";
							json.meetings.push(meeting);
						}
						res.send(JSON.stringify(json));
						connection.end();
					});
				}
				else
				{
					res.send("403");
				}
			}
			if(close)
				connection.end();
		});
	}
	else
	{
		res.status(403);
		res.sendFile(__dirname + "/forbidden.html");
	}
});

app.get("/logout", function(req, res)
{
	log("The user " + req.session.username + " log outs");
	req.session = null;
	//res.sendFile(__dirname + "/index.html");
	res.redirect("/");
});

app.post('/login', function(req, res)
{
	var username = req.body.username.toString();
	var password = req.body.password.toString();
	log("Attempt to login: username: " + username + " password: " + password);
	if((username.length >= 255) || (password.length >= 255))
	{
		log("Username or password too long");
		res.redirect("/?startAtScreen=login&errorCode=7");
		return;
	}
	if(!validName(username))
	{
		log("Invalid username");
		//res.status(403);
		//res.sendFile(__dirname + "/forbidden.html");
		res.redirect("/?startAtScreen=login&errorCode=0");
		return;
	}
	var connection = mysql.createConnection(
	{
		host     : config.database.host,
		user     : config.database.user,
		password : config.database.password,
		database: config.database.name
	});
	var matched = false;
	connection.query("SELECT * FROM `usuarios` WHERE `apodo`=" + connection.escape(username + ""), function(err, rows)
	{
		if(handleErrors(err))
		{
			res.status(500);
			res.sendFile(__dirname + "/servererror.html");
			return;
		}
		if((typeof rows === "undefined") || (typeof rows[0] === "undefined"))
		{
			handleErrors(new Error("Unexpected query result null"));
			res.status(500);
			res.sendFile(__dirname + "/servererror.html");
			connection.end();
			return;
		}
		log("Matched user in database");
		if(bcrypt.compareSync(password, rows[0].contrasenna) && (rows[0].activo == "1"))
		{
			log("Yes, the user matches");
			req.session.username = username;
			req.session.valid = "true";
			req.session.uid = rows[0].id;
			req.session.pid = rows[0].persona;
			req.session.eid = rows[0].permisos;
			matched = true;
			var time = datetimeToSQL(new Date());
			log("Actualizando el ultimo acceso a " + time);
			connection.query("UPDATE `usuarios` SET `ultimo_acceso`=" + connection.escape(time + "") + " WHERE `id`=" + connection.escape(rows[0].id + ""), function(err, rows)
			{
				if(handleErrors(err))
				{
					res.status(500);
					res.sendFile(__dirname + "/servererror.html");
					return;
				}
				log("Correcto");
				var p = "";
				connection.query("SELECT * FROM `permisos` WHERE `id`=" + connection.escape(req.session.eid + ""), function(err, rows)
				{
					if(handleErrors(err))
					{
						res.status(500);
						res.sendFile(__dirname + "/servererror.html");
						return;
					}
					if((typeof rows === "undefined") || (typeof rows[0] === "undefined"))
					{
						handleErrors(new Error("Unexpected query result null"));
						res.status(500);
						res.sendFile(__dirname + "/servererror.html");
						connection.end();
						return;
					}
					log("Matched " + JSON.stringify(rows));
					p = rows[0].crear + "" + rows[0].cerrar + "" + rows[0].ingresar + "" + rows[0].listar + "" + rows[0].configurar;
					if(p.charAt(2) == "0")
					{
						log("The user " + req.session.username + " log outs in error");
						req.session = null;
						res.redirect("/?errorCode=1");
					}
					else
					{
						res.redirect("/user");
					}
					connection.end();
				});
			});
		}
		else
		{
			log("The user not matches");
			//res.sendFile(__dirname + "/forbidden.html");
			res.redirect("/?startAtScreen=login&errorCode=0" + ((rows[0].activo == "0")? "&canceled=1" : ""));
			connection.end();
		}
	});
});

app.get("/meeting", function(req, res)
{
	if((req.session !== null) && (req.session.valid === "true"))
	{
		var post = req.body;
		var connection = mysql.createConnection(
		{
			host     : config.database.host,
			user     : config.database.user,
			password : config.database.password,
			database: config.database.name
		});
		var p = "";
		connection.query("SELECT * FROM `permisos` WHERE `id`=" + connection.escape(req.session.eid + ""), function(err, rows)
		{
			if(handleErrors(err))
			{
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				return;
			}
			if((typeof rows === "undefined") || (typeof rows[0] === "undefined"))
			{
				handleErrors(new Error("Unexpected query result null"));
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				connection.end();
				return;
			}
			log("Matched " + JSON.stringify(rows));
			p = rows[0].crear + "" + rows[0].cerrar + "" + rows[0].ingresar + "" + rows[0].listar + "" + rows[0].configurar;
			if(p.charAt(2) == "1")
			{
				requestAllUserData(connection, res, "SELECT * FROM `usuarios` WHERE `id` = ?", [req.session.uid + ""], function(err, rd, pp, ps, sl)
				{
					if(handleErrors(err))
					{
						res.status(500);
						res.sendFile(__dirname + "/servererror.html");
						return;
					}
					// rd = user, pp = person, ps = permissions, sl = rooms -> json2push
					var user = getStdUserData(rd, pp, ps, sl);
					if((p.charAt(0) == "1") && (p.charAt(1) == "1"))
					{
						user.roompasswd = sl[0].clave_moderador;
					}
					else
					{
						user.roompasswd = sl[0].clave_usuario;
					}
					user.tiempo_creado = sl[0].tiempo_creado;
					return user;
				}, function(err, json)
				{
					if(handleErrors(err))
					{
						res.status(500);
						res.sendFile(__dirname + "/servererror.html");
						return;
					}
					var user = json.users[0];
					// Ahora debemos generar el enlace
					var fullName = user.name + " " + user.lastname + "(" + user.username + ")";
					var meetingID = user.nextroomid;
					var password = user.roompasswd;
					var createTime = user.tiempo_creado;
					var userID = user.username;
					if(meetingID != "nada")
					{
						var url = parseBBB("join", {
							"fullName": encodeURI(fullName),
							"meetingID": meetingID,
							"password": password,
							"createTime": createTime,
							"userID": encodeURI(userID)
						});
						log("Redirecting to " + url);
						connection.end();
						res.writeHead(307, {'Location': url});
						res.end();
					}
					else
					{
						log("La sala no esta disponible");
						connection.end();
						res.redirect("/noroom");
					}
				});
			}
			else
			{
				res.status(403);
				res.sendFile(__dirname + "/forbidden.html");
				connection.end();
			}
		});
	}
	else
	{
		res.redirect("/");
	}
});

app.get("/joinRoom", function(req, res)
{
	if((req.session !== null) && (req.session.valid === "true"))
	{
		var post = req.body;
		var connection = mysql.createConnection(
		{
			host     : config.database.host,
			user     : config.database.user,
			password : config.database.password,
			database: config.database.name
		});
		var p = "";
		connection.query("SELECT * FROM `permisos` WHERE `id`=" + connection.escape(req.session.eid + ""), function(err, rows)
		{
			if(handleErrors(err))
			{
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				return;
			}
			if((typeof rows === "undefined") || (typeof rows[0] === "undefined"))
			{
				handleErrors(new Error("Unexpected query result null"));
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				connection.end();
				return;
			}
			log("Matched " + JSON.stringify(rows));
			p = rows[0].crear + "" + rows[0].cerrar + "" + rows[0].ingresar + "" + rows[0].listar + "" + rows[0].configurar;
			if(p.charAt(2) == "1")
			{
				if(typeof req.query.id === "undefined")
				{
					handleErrors(new Error("Undefined ID of the room"));
					res.redirect("/user");
					connection.end();
					return;
				}
				connection.query("SELECT * FROM `salas` WHERE `bbbid` = ?", [req.query.id], function(err, sl)
				{
					if(handleErrors(err))
					{
						res.status(500);
						res.sendFile(__dirname + "/servererror.html");
						return;
					}
					if(typeof sl === "undefined")
					{
						handleErrors(new Error("Unexpected query result null"));
						res.status(500);
						res.sendFile(__dirname + "/servererror.html");
						connection.end();
						return;
					}
					if(sl.length == 0)
					{
						handleErrors(new Error("The room not exits"));
						connection.end();
						res.redirect("/user");
						return;
					}
					requestAllUserData(connection, res, "SELECT * FROM `usuarios` WHERE `id` = ?", [req.session.uid + ""], function(err, rd, pp, ps, _sl)
					{
						if(handleErrors(err))
						{
							res.status(500);
							res.sendFile(__dirname + "/servererror.html");
							return;
						}
						// rd = user, pp = person, ps = permissions, sl = rooms -> json2push
						var user = getStdUserData(rd, pp, ps, sl);
						if((p.charAt(0) == "1") && (p.charAt(1) == "1"))
						{
							user.roompasswd = sl[0].clave_moderador;
						}
						else
						{
							user.roompasswd = sl[0].clave_usuario;
						}
						user.tiempo_creado = sl[0].tiempo_creado;
						return user;
					}, function(err, json)
					{
						if(handleErrors(err))
						{
							res.status(500);
							res.sendFile(__dirname + "/servererror.html");
							return;
						}
						var user = json.users[0];
						// Ahora debemos generar el enlace
						var fullName = user.name + " " + user.lastname + "(" + user.username + ")";
						var meetingID = encodeURI(req.query.id);
						var password = user.roompasswd;
						var createTime = user.tiempo_creado;
						var userID = user.username;
						if(meetingID != "nada")
						{
							var url = parseBBB("join", {
								"fullName": encodeURI(fullName),
								"meetingID": meetingID,
								"password": password,
								"createTime": createTime,
								"userID": encodeURI(userID)
							});
							log("Redirecting to " + url);
							connection.end();
							res.writeHead(307, {'Location': url});
							res.end();
						}
						else
						{
							log("La sala no esta disponible");
							connection.end();
							res.redirect("/noroom");
						}
					});
				});
			}
			else
			{
				res.status(403);
				res.sendFile(__dirname + "/forbidden.html");
				connection.end();
			}
		});
	}
	else
	{
		res.redirect("/user");
	}
});

app.get("/noroom", function(req, res)
{
	if((req.session !== null) && (req.session.valid === "true"))
	{
		var post = req.body;
		var connection = mysql.createConnection(
		{
			host     : config.database.host,
			user     : config.database.user,
			password : config.database.password,
			database: config.database.name
		});
		var p = "";
		connection.query("SELECT * FROM `permisos` WHERE `id`=" + connection.escape(req.session.eid + ""), function(err, rows)
		{
			if(handleErrors(err))
			{
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				return;
			}
			if((typeof rows === "undefined") || (typeof rows[0] === "undefined"))
			{
				handleErrors(new Error("Unexpected query result null"));
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				connection.end();
				return;
			}
			log("Matched " + JSON.stringify(rows));
			p = rows[0].crear + "" + rows[0].cerrar + "" + rows[0].ingresar + "" + rows[0].listar + "" + rows[0].configurar;
			res.send(
				fs.readFileSync(__dirname + "/header.frame.html") +
				fs.readFileSync(__dirname + "/noroom.frame.html") +
				fs.readFileSync(__dirname + "/footer.frame.html")
			);
		});
	}
	else
	{
		res.redirect("/");
	}
});

app.get("/managerooms", function(req, res)
{
	if((req.session !== null) && (req.session.valid === "true"))
	{
		var post = req.body;
		var connection = mysql.createConnection(
		{
			host     : config.database.host,
			user     : config.database.user,
			password : config.database.password,
			database: config.database.name
		});
		var p = "";
		connection.query("SELECT * FROM `permisos` WHERE `id`=" + connection.escape(req.session.eid + ""), function(err, rows)
		{
			if(handleErrors(err))
			{
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				return;
			}
			if((typeof rows === "undefined") || (typeof rows[0] === "undefined"))
			{
				handleErrors(new Error("Unexpected query result null"));
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				connection.end();
				return;
			}
			log("Matched " + JSON.stringify(rows));
			p = rows[0].crear + "" + rows[0].cerrar + "" + rows[0].ingresar + "" + rows[0].listar + "" + rows[0].configurar;
			if((p.charAt(0) == "1") || (p.charAt(1) == "1"))
			{
				res.sendFile(__dirname + "/adminrooms.html");
			}
			else
			{
				res.status(403);
				res.sendFile(__dirname + "/forbidden.html");
			}
		});
	}
	else
	{
		res.redirect("/");
	}
});

app.post("/managerooms", function(req, res)
{
	if((req.session !== null) && (req.session.valid === "true"))
	{
		var post = req.body;
		var connection = mysql.createConnection(
		{
			host     : config.database.host,
			user     : config.database.user,
			password : config.database.password,
			database: config.database.name
		});
		var p = "";
		connection.query("SELECT * FROM `permisos` WHERE `id`=" + connection.escape(req.session.eid + ""), function(err, rows)
		{
			if(handleErrors(err))
			{
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				return;
			}
			if((typeof rows === "undefined") || (typeof rows[0] === "undefined"))
			{
				handleErrors(new Error("Unexpected query result null"));
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				connection.end();
				return;
			}
			log("Matched " + JSON.stringify(rows));
			p = rows[0].crear + "" + rows[0].cerrar + "" + rows[0].ingresar + "" + rows[0].listar + "" + rows[0].configurar;
			if((p.charAt(0) == "1") && (p.charAt(1) == "1"))
			{
				var action = req.body.action;
				var valid = function(foo)
				{
					return (typeof foo !== "undefined") || (foo != "");
				};
				if(!valid(action))
				{
					handleErrors(new Error("Invalid action for manage rooms " + action));
					res.redirect("/managerooms");
					return;
				}
				if(action == "close")
				{
					var id = req.body.id;
					var delete_in_error = false;
					if(id.match(/^[a-z][a-z0-9]+$/gm) === null)
					{
						handleErrors(new Error("Invalid id for room"));
						res.redirect("/managerooms");
						return;
					}
					log("Eliminando " + id);
					connection.query("SELECT * FROM `salas` WHERE `bbbid` = ?", [id], function(err, sl)
					{
						if(handleErrors(err))
						{
							res.status(500);
							res.sendFile(__dirname + "/servererror.html");
							return;
						}
						if((typeof sl === "undefined") || (typeof sl[0] === "undefined"))
						{
							handleErrors(new Error("Unexpected query result null"));
							res.status(500);
							res.sendFile(__dirname + "/servererror.html");
							connection.end();
							return;
						}
						log("Obtenidos datos de la sala");
						var modpasswd = sl[0].clave_moderador;
						var sid = sl[0].id;
						log("modpassword " + modpasswd);
						callBBB("end", {
							meetingID: id,
							password: modpasswd
						}, function(err, xml)
						{
							if(handleErrors(err))
							{
								res.status(500);
								res.sendFile(__dirname + "/servererror.html");
								return;
							}
							log("Intento de cerrarse con BBB");
							var status = xml.getElementsByTagName("returncode");
							if(status.length <= 0)
							{
								handleErrors(new Error("No se puede contactar correctamente con BigBlueButton"));
								res.sendFile(__dirname + "/servererror.html");
								return;
							}
							status = status[0].textContent;
							log("Eliminada correctamente? " + status);
							if(status == "FAILED")
							{
								var key = xml.getElementsByTagName("messageKey")[0].textContent;
								if(key == "notFound")
								{
									log("Sala no existente: borrando para seguir ACID");
									delete_in_error = true;
								}
							}
							if((status == "SUCCESS") || delete_in_error)
							{
								log("Si, eliminando de la DB");
								connection.query("UPDATE `usuarios` SET `sala` = 0 WHERE `sala` = ?", [sid], function(err, rows)
								{
									if(handleErrors(err))
									{
										res.status(500);
										res.sendFile(__dirname + "/servererror.html");
										return;
									}
									if(typeof rows === "undefined")
									{
										handleErrors(new Error("Unexpected query result null"));
										res.status(500);
										res.sendFile(__dirname + "/servererror.html");
										connection.end();
										return;
									}
									log("Actualizados los usuarios");
									connection.query("DELETE FROM `salas` WHERE `bbbid` = ?", [id], function(err, rows)
									{
										if(handleErrors(err))
										{
											res.status(500);
											res.sendFile(__dirname + "/servererror.html");
											return;
										}
										if(typeof rows === "undefined")
										{
											handleErrors(new Error("Unexpected query result null"));
											res.status(500);
											res.sendFile(__dirname + "/servererror.html");
											connection.end();
											return;
										}
										log("Eliminada sala de la DB");
										connection.end();
										res.redirect("/managerooms");
									});
								});
							}
							else
							{
								res.redirect("/managerooms?errorBBB=" + xml.getElementsByTagName("message")[0].textContent);
								connection.end();
							}
						});
					});
				}
				if(action == "new")
				{
					var name = req.body.name || "";
					var id = req.body.id || "";
					var modpasswd = req.body.modpasswd || "a123b456";
					var userpasswd = req.body.userpasswd || "1234";
					var starts = req.body.starts || "2016-01-01 00:00";
					var ends = req.body.ends || "2016-01-01 00:00";
					var maxs = req.body.maxs || "2016-01-01 00:00";
					var maxenabled = req.body.maxenabled || "false";
					var vpublic = req.body.public || "false";
					var users = req.body.users || "";
					var timecreated = "";
					var date = /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-3][0-9]) ([0-1][0-9]|2[0-3]):[0-5][0-9]$/gm;
					var ulist = /^[a-zA-Z0-9, ]*$/gm;
					var checkbox = /^(false|true)$/gmi;
					var password = /^[a-zA-Z0-9]+$/gm;
					if(id.match(/^[a-z][a-z0-9]+$/gm) === null)
					{
						handleErrors(new Error("Invalid id for room"));
						res.redirect("/managerooms?errorCode=8");
						return;
					}
					if((starts.match(date) === null) ||
						(ends.match(date) === null) ||
						(maxs.match(date) === null))
					{
						handleErrors(new Error("Invalid date for room"));
						res.redirect("/managerooms?errorCode=9");
						return;
					}
					if((vpublic.match(checkbox) === null) ||
						(maxenabled.match(checkbox) === null))
					{
						handleErrors(new Error("Invalid checkboxes for room"));
						res.redirect("/managerooms?errorCode=10");
						return;
					}
					if((modpasswd.match(password) === null) ||
						(userpasswd.match(password) === null) ||
						(modpasswd == userpasswd))
					{
						handleErrors(new Error("Invalid passwords for room"));
						res.redirect("/managerooms?errorCode=10");
						return;
					}
					if(users.match(ulist) === null)
					{
						handleErrors(new Error("Invalid user list for room"));
						res.redirect("/managerooms?errorCode=10");
						return;
					}
					vpublic = (vpublic == "true")? 1 : 0;
					maxenabled = (maxenabled == "true")? 1 : 0;
					var userlist = users.split(",").map(function(user)
					{
						return user.trim();
					});
					var args = {
						id: null,
						bbbid: id,
						inicio: starts,
						hasta: ends,
						restriccion: maxenabled,
						publica: vpublic,
						max_entrada: maxs,
						clave_moderador: modpasswd,
						clave_usuario: userpasswd,
						tiempo_creado: "",
						nombre: name
					};
					var logout = "http://" + ip.address() + ":" + config.server.port + "/meetingUserLogsOuts";
					log("Creando sala con " + logout);
					callBBB("create", {
						name: name,
						meetingID: id,
						attendeePW: userpasswd,
						moderatorPW: modpasswd,
						logoutURL: logout
					}, function(err, xml)
					{
						if(handleErrors(err))
						{
							res.status(500);
							res.sendFile(__dirname + "/servererror.html");
							return;
						}
						timecreated = xml.getElementsByTagName("createTime")[0].textContent;
						args.tiempo_creado = timecreated;
						log("BBB request correcto");
						connection.query("INSERT INTO `salas` SET ?", args, function(err, sl)
						{
							log("Getting " + JSON.stringify(sl));
							if(handleErrors(err))
							{
								res.status(500);
								res.sendFile(__dirname + "/servererror.html");
								return;
							}
							if(typeof sl === "undefined")
							{
								handleErrors(new Error("Unexpected query result null"));
								res.status(500);
								res.sendFile(__dirname + "/servererror.html");
								connection.end();
								return;
							}
							log("SQL request correcto");
							for(var i = 0;i < userlist.length;i++)
							{
								log("Intento con el usuario " + userlist[i]);
								connection.query("UPDATE `usuarios` SET `sala` = ? WHERE `apodo` = ?", [sl.insertId, userlist[i]], function(index, err, user)
								{
									if(handleErrors(err))
									{
										res.status(500);
										res.sendFile(__dirname + "/servererror.html");
										return;
									}
									log("Actualizado usuario en " + index + "/" + userlist.length);
									if(index >= (userlist.length - 1))
									{
										log("Terminado");
										connection.end();
										res.redirect("/managerooms");
									}
								}.bind(connection, i));
							}
						});
					});
				}
			}
			else
			{
				res.status(403);
				res.sendFile(__dirname + "/forbidden.html");
			}
		});
	}
	else
	{
		res.redirect("/");
	}
});

app.get("/meetingUserLogsOuts", function(req, res)
{
	if((req.session !== null) && (req.session.valid === "true"))
	{
		var post = req.body;
		var connection = mysql.createConnection(
		{
			host     : config.database.host,
			user     : config.database.user,
			password : config.database.password,
			database: config.database.name
		});
		var p = "";
		connection.query("SELECT * FROM `permisos` WHERE `id`=" + connection.escape(req.session.eid + ""), function(err, rows)
		{
			if(handleErrors(err))
			{
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				return;
			}
			if((typeof rows === "undefined") || (typeof rows[0] === "undefined"))
			{
				handleErrors(new Error("Unexpected query result null"));
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				connection.end();
				return;
			}
			log("Matched " + JSON.stringify(rows));
			p = rows[0].crear + "" + rows[0].cerrar + "" + rows[0].ingresar + "" + rows[0].listar + "" + rows[0].configurar;
			if(p.charAt(2) == "1")
			{
				requestAllUserData(connection, res, "SELECT * FROM `usuarios` WHERE `id` = ?", [req.session.uid], function(err, rd, pp, ps, sl)
				{
					if(handleErrors(err))
					{
						res.status(500);
						res.sendFile(__dirname + "/servererror.html");
						return;
					}
					return getStdUserData(rd, pp, ps, sl);
				}, function(err, json)
				{
					if(handleErrors(err))
					{
						res.status(500);
						res.sendFile(__dirname + "/servererror.html");
						return;
					}
					var user = json.users[0];
					log("El usuario " + user.nickname + " se desconecta de BBB (posible fake)");
					if(user.nextroomid == "nada")
					{
						log("Fake: el usuario estaba conectado a la sala nada@nada");
						connection.end();
						return;
					}
					log("Posible cierto, el usuario estaba conectado a " + user.nextroom + "@" + user.nextroomid);
					/*callBBB("isMeetingRunning", {
						meetingID: user.nextroomid
					}, function(err, xml)
					{
						if(handleErrors(err))
						{
							res.status(500);
							res.sendFile(__dirname + "/servererror.html");
							return;
						}
						var running = xml.getElementsByTagName("running")[0].textContent == "true";
						log("Running: " + running);
					});*/
					log("Abortado por seguridad fallida");
					/*
					¿Porque no realizo accion alguna?
					Supongamos que el usuario se le asigna una clase, y el por error
					(o intencional) accede a /meetingUserLogsOuts, asumiendo que aún
					ningun usuario se hubiese conectado a la sala, esto la cerraria y
					permitiria a los usuarios comunes manipular el sistema (un hacker
					puede hacerse una cuenta, y cada vez que se le asigne una sala
					llamar a /meetingUserLogsOuts inmediatamente: la sala nunca se
					abriría).
					Dicho esto, no puedo realizar acción: el usuario podría reconectarse
					asumiendo que se salio por error y la única manera de que una sala se
					cierre es que un moderador+ la cierre manualmente o BBB la cierre
					por no tener personas.
					*/
					res.redirect("/user");
					connection.end();
				});
			}
			else
			{
				res.status(403);
				res.sendFile(__dirname + "/forbidden.html");
			}
		});
	}
	else
	{
		res.redirect("/");
	}
});

app.post("/changePassword", function(req, res)
{
	if((req.session !== null) && (req.session.valid === "true"))
	{
		var post = req.body;
		var connection = mysql.createConnection(
		{
			host     : config.database.host,
			user     : config.database.user,
			password : config.database.password,
			database: config.database.name
		});
		var p = "";
		connection.query("SELECT * FROM `permisos` WHERE `id`=" + connection.escape(req.session.eid + ""), function(err, rows)
		{
			if(handleErrors(err))
			{
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				return;
			}
			if((typeof rows === "undefined") || (typeof rows[0] === "undefined"))
			{
				handleErrors(new Error("Unexpected query result null"));
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				connection.end();
				return;
			}
			log("Matched " + JSON.stringify(rows));
			p = rows[0].crear + "" + rows[0].cerrar + "" + rows[0].ingresar + "" + rows[0].listar + "" + rows[0].configurar;
			if(p.charAt(2) == "1")
			{
				var p1 = req.body.p1 || "a";
				var p2 = req.body.p2 || "b";
				if((p1.match(/^[a-zA-Z0-9_\-+]+$/gm) === null) ||
					(p2.match(/^[a-zA-Z0-9_\-+]+$/gm) === null))
				{
					handleErrors(new Error("The passwords are invalids"));
					connection.end();
					return;
				}
				if(p1 === p2)
				{
					connection.query("UPDATE `usuarios` SET `contrasenna` = ? WHERE `id` = ?", [bcrypt.hashSync(p1, bcrypt.genSaltSync()), req.session.uid], function(err, rows)
					{
						if(handleErrors(err))
						{
							res.status(500);
							res.sendFile(__dirname + "/servererror.html");
							return;
						}
						if(typeof rows === "undefined")
						{
							handleErrors(new Error("Unexpected query result null"));
							res.status(500);
							res.sendFile(__dirname + "/servererror.html");
							connection.end();
							return;
						}
						res.redirect("/user?changed=successful");
						connection.end();
					});
				}
				else
				{
					log("The passwords are different");
					res.redirect("/user?errorCode=0");
					connection.end();
				}
			}
			else
			{
				res.status(403);
				res.sendFile(__dirname + "/forbidden.html");
			}
		});
	}
	else
	{
		res.redirect("/");
	}
});

app.get("/public", function(req, res)
{
	var r = req.query.request;
	if((typeof r !== "undefined") && (r != ""))
	{
		if(r == "rooms")
		{
			var connection = mysql.createConnection(
			{
				host     : config.database.host,
				user     : config.database.user,
				password : config.database.password,
				database: config.database.name
			});
			connection.query("SELECT `bbbid`, `nombre` FROM `salas` WHERE `publica` = 1", function(err, rows)
			{
				if(handleErrors(err))
				{
					res.status(500);
					res.sendFile(__dirname + "/servererror.html");
					return;
				}
				if((typeof rows === "undefined") || (typeof rows[0] === "undefined"))
				{
					log("Not have public rooms");
					res.send("{rooms:[]}");
					return;
				}
				var json = {rooms: []};
				for(var i = 0;i < rows.length;i++)
				{
					json.rooms.push({id: rows[i].bbbid, nombre: rows[i].nombre});
				}
				res.send(JSON.stringify(json));
				connection.end();
			});
		}
	}
});

app.post("/joinPublic", function(req, res)
{
	var name = req.body.name;
	var username = req.body.username;
	var rname = req.body.rname;
	if((username.match(/^[a-zA-Z0-9_]+$/gm) === null) ||
		(rname.match(/^[a-z0-9]+$/gm) === null))
	{
		handleErrors(new Error("Invalid data for the request"));
		res.redirect("/?errorCode=0");
		return;
	}
	var connection = mysql.createConnection(
	{
		host     : config.database.host,
		user     : config.database.user,
		password : config.database.password,
		database: config.database.name
	});
	//connection.query("SELECT *")
	connection.query("SELECT * FROM `salas` WHERE `publica` = 1 AND `bbbid` = ?", [rname], function(err, rows)
	{
		if(handleErrors(err))
		{
			res.status(500);
			res.sendFile(__dirname + "/servererror.html");
			return;
		}
		if((typeof rows === "undefined") || (typeof rows[0] === "undefined"))
		{
			handleErrors(new Error("Not have public rooms"));
			res.redirect("/");
			return;
		}
		var fullName = name + "(" + username + ")";
		var meetingID = rname;
		var password = rows[0].clave_usuario;
		var createTime = rows[0].tiempo_creado;
		var userID = username;
		var url = parseBBB("join", {
			"fullName": encodeURI(fullName),
			"meetingID": meetingID,
			"password": password,
			"createTime": createTime,
			"userID": encodeURI(userID)
		});
		connection.query("SELECT * FROM `usuarios` WHERE `apodo` = ?", [username], function(err, rws)
		{
			if(handleErrors(err))
			{
				res.status(500);
				res.sendFile(__dirname + "/servererror.html");
				return;
			}
			if(typeof rws === "undefined")
			{
				handleErrors(new Error("The user exists"));
				res.redirect("/");
				return;
			}
			if(rws.length == 0)
			{
				log("Redirecting to " + url);
				connection.end();
				res.writeHead(307, {'Location': url});
				res.end();
			}
			else
			{
				res.redirect("/?errorCode=0");
			}
		});
	});
});

app.get("*", function(req, res)
{
	res.status(404);
	res.location("/");
	res.sendFile(__dirname + "/notfound.html");
});

app.post("*", function(req, res)
{
	res.status(404);
	res.location("/");
	res.sendFile(__dirname + "/notfound.html");
});

/*

io.on('connection', function(socket)
{
	log("A user conect");
	socket.emit("info", "login");
	socket.on('disconnect', function()
	{
		log("A user disconect");
	});
});

*/
