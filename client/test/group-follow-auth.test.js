import assert from 'node:assert/strict';
import test from 'node:test';
import { getPostLoginPath } from '../src/app/authNavigation.js';

test('login returns a visitor to the selected public community group', () => {
  const user = { id: 9 };
  assert.equal(
    getPostLoginPath(user, '/community?follow=department%3A12'),
    '/community?follow=department%3A12',
  );
  assert.equal(
    getPostLoginPath(user, '/bible-study?follow=bible_study_group%3A12'),
    '/community?follow=bible_study_group%3A12',
  );
});

test('login does not accept an external follow return URL', () => {
  assert.equal(getPostLoginPath({ id: 9 }, '//example.com/community?follow=department%3A12'), '/community');
});
