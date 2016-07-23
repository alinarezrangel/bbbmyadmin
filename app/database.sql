-- phpMyAdmin SQL Dump
-- version 4.5.4.1deb2ubuntu2
-- http://www.phpmyadmin.net
--
-- Host: localhost
-- Generation Time: Jul 23, 2016 at 03:41 PM
-- Server version: 5.7.13-0ubuntu0.16.04.2
-- PHP Version: 7.0.8-0ubuntu0.16.04.1

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `bbbmyadmin`
--

-- --------------------------------------------------------

--
-- Table structure for table `permisos`
--

CREATE TABLE `permisos` (
  `id` int(20) UNSIGNED NOT NULL,
  `crear` tinyint(1) NOT NULL,
  `cerrar` tinyint(1) NOT NULL,
  `ingresar` tinyint(1) NOT NULL,
  `listar` tinyint(1) NOT NULL,
  `configurar` int(11) NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

--
-- Dumping data for table `permisos`
--

INSERT INTO `permisos` (`id`, `crear`, `cerrar`, `ingresar`, `listar`, `configurar`) VALUES
(0, 0, 0, 1, 0, 0),
(1, 1, 1, 1, 1, 1),
(2, 1, 1, 1, 1, 0),
(3, 0, 0, 0, 0, 0);

-- --------------------------------------------------------

--
-- Table structure for table `personas`
--

CREATE TABLE `personas` (
  `nombre` varchar(255) COLLATE utf8_unicode_ci NOT NULL COMMENT 'nombre de la persona',
  `apellidos` varchar(255) COLLATE utf8_unicode_ci NOT NULL COMMENT 'apellidos de la persona',
  `cedula` int(20) UNSIGNED DEFAULT NULL COMMENT 'celula de identidad de la persona',
  `id` int(20) UNSIGNED NOT NULL COMMENT 'id de la persona'
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='Representa una persona en el sistema';

--
-- Dumping data for table `personas`
--

INSERT INTO `personas` (`nombre`, `apellidos`, `cedula`, `id`) VALUES
('Administrador', 'predeterminado', 0, 0),
('Moderador', 'perdeterminado', 1, 1),
('Usuario', 'predeterminado', 2, 2);

-- --------------------------------------------------------

--
-- Table structure for table `salas`
--

CREATE TABLE `salas` (
  `id` int(20) UNSIGNED NOT NULL,
  `bbbid` varchar(255) COLLATE utf8_spanish_ci NOT NULL,
  `inicio` datetime NOT NULL,
  `hasta` datetime NOT NULL,
  `restriccion` tinyint(1) NOT NULL,
  `publica` tinyint(1) NOT NULL,
  `max_entrada` datetime NOT NULL,
  `clave_moderador` varchar(255) COLLATE utf8_spanish_ci NOT NULL DEFAULT '',
  `clave_usuario` varchar(255) COLLATE utf8_spanish_ci NOT NULL DEFAULT '',
  `tiempo_creado` varchar(255) COLLATE utf8_spanish_ci NOT NULL,
  `nombre` varchar(255) COLLATE utf8_spanish_ci NOT NULL DEFAULT 'nada'
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_spanish_ci;

--
-- Dumping data for table `salas`
--

INSERT INTO `salas` (`id`, `bbbid`, `inicio`, `hasta`, `restriccion`, `publica`, `max_entrada`, `clave_moderador`, `clave_usuario`, `tiempo_creado`, `nombre`) VALUES
(0, 'nada', '2016-01-01 00:00:00', '2016-01-01 00:00:00', 0, 0, '2016-01-01 00:00:00', '', '', '', 'nada');

-- --------------------------------------------------------

--
-- Table structure for table `usuarios`
--

CREATE TABLE `usuarios` (
  `apodo` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `contrasenna` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `persona` int(20) UNSIGNED NOT NULL,
  `permisos` int(20) UNSIGNED NOT NULL,
  `email` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  `id` int(20) UNSIGNED NOT NULL,
  `ultimo_acceso` datetime NOT NULL DEFAULT '2016-01-01 00:00:00',
  `sala` int(20) UNSIGNED NOT NULL COMMENT 'sala a la que debe entrar',
  `activo` tinyint(1) NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

--
-- Dumping data for table `usuarios`
--

INSERT INTO `usuarios` (`apodo`, `contrasenna`, `persona`, `permisos`, `email`, `id`, `ultimo_acceso`, `sala`, `activo`) VALUES
('admin', '$2a$10$1LxlSlj.ezYPeKzplfIyz.TzBC4BGHibXytcpbXot2yxHakmRc4R.', 0, 1, 'alinarezrangel@gmail.com', 1, '2016-07-19 18:01:25', 0, 1),
('user', '$2a$10$9JBgUf05jnDZoXUnRyjG4.tTD.jMJTnOo0flQJjSJWzBmCIM9MKLO', 2, 0, 'alinarezrangel@gmail.com', 2, '2016-07-12 15:54:08', 0, 1),
('mod', '$2a$10$9JBgUf05jnDZoXUnRyjG4.tTD.jMJTnOo0flQJjSJWzBmCIM9MKLO', 1, 2, 'alinarezrangel@gmail.com', 3, '2016-07-11 23:21:00', 0, 1);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `permisos`
--
ALTER TABLE `permisos`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `personas`
--
ALTER TABLE `personas`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `cedula` (`cedula`);

--
-- Indexes for table `salas`
--
ALTER TABLE `salas`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `bbbid` (`bbbid`);

--
-- Indexes for table `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `persona` (`persona`),
  ADD UNIQUE KEY `apodo` (`apodo`),
  ADD KEY `permisos` (`permisos`),
  ADD KEY `sala` (`sala`) USING BTREE;

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `permisos`
--
ALTER TABLE `permisos`
  MODIFY `id` int(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;
--
-- AUTO_INCREMENT for table `personas`
--
ALTER TABLE `personas`
  MODIFY `id` int(20) UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'id de la persona', AUTO_INCREMENT=3;
--
-- AUTO_INCREMENT for table `salas`
--
ALTER TABLE `salas`
  MODIFY `id` int(20) UNSIGNED NOT NULL AUTO_INCREMENT;
--
-- AUTO_INCREMENT for table `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id` int(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;
--
-- Constraints for dumped tables
--

--
-- Constraints for table `usuarios`
--
ALTER TABLE `usuarios`
  ADD CONSTRAINT `usuarios_ibfk_1` FOREIGN KEY (`permisos`) REFERENCES `permisos` (`id`),
  ADD CONSTRAINT `usuarios_ibfk_2` FOREIGN KEY (`persona`) REFERENCES `personas` (`id`),
  ADD CONSTRAINT `usuarios_ibfk_3` FOREIGN KEY (`sala`) REFERENCES `salas` (`id`);

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
